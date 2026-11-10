import { getProfileDir, VoiceResourceManager } from "@loop/coding-agent";
import { join } from "node:path";

import { Accounts } from "./accounts";
import { acquireAccountLock } from "./account-lock";
import { accountRoutes } from "./account-routes";
import { createUserRuntime } from "./user-runtime";
import type { UserRuntime } from "./user-runtime";
import { assertLocalRequest } from "../http/local-request";
import { errorResponse, HttpError } from "../http/errors";
import { remoteResponse } from "../remote-access/remote-response";
import { DeviceStore } from "../remote-access/device-store";
import type { BusinessContext } from "../http/business-context";
import type { Account } from "../../shared/accounts";
import type { WebSocket } from "ws";
import type { BusinessWorker } from "./business-worker";

export const createAccountServer = async (
  root: string,
  assets: string,
  worker?: BusinessWorker,
) => {
  const unlock = await acquireAccountLock(root);
  const accounts = new Accounts(root);
  try {
    await accounts.load();
  } catch (error) {
    await unlock();
    throw error;
  }
  const authRoute = accountRoutes(accounts);
  const resources = new VoiceResourceManager(root);
  const runtimes = new Map<string, Promise<UserRuntime>>();
  accounts.subscribe(async (id) => {
    const runtime = runtimes.get(id);
    if (runtime) await (await runtime).invalidate();
    else {
      await new DeviceStore(
        join(getProfileDir(id, root), "web-ui", "remote-access", "devices.json"),
      ).save([]);
    }
  });
  accounts.logins.subscribe(async (login) => {
    const runtime = runtimes.get(login.userId);
    if (runtime) await (await runtime).voice.revoke(login.hash);
    else await worker?.revokeVoice(login.hash);
  });
  let closing = false;
  const runtimeFor = (user: Account) => {
    if (closing) throw new HttpError(503, "server_closing");
    let runtime = runtimes.get(user.id);
    if (!runtime) {
      runtime = createUserRuntime(root, user, assets, resources, accounts, worker).catch(
        (error) => {
          runtimes.delete(user.id);
          throw error;
        },
      );
      runtimes.set(user.id, runtime);
    }
    return runtime;
  };
  const contextFor = (request: Request): BusinessContext => {
    assertLocalRequest(request);
    const { user, login } = accounts.authenticate(request);
    return {
      principal: login.hash,
      userId: user.id,
      remote: false,
      expiresAt: login.expiresAt,
    };
  };
  return {
    accounts,
    handle: async (request: Request): Promise<Response> => {
      try {
        assertLocalRequest(request);
        if (
          !["GET", "HEAD"].includes(request.method) &&
          request.headers.get("origin") !== new URL(request.url).origin
        )
          throw new HttpError(403, "invalid_origin");
        if (new URL(request.url).pathname.startsWith("/api/auth/")) {
          const response = await authRoute(request);
          response.headers.set("Cache-Control", "no-store");
          return response;
        }
        const { user, login } = accounts.authenticate(request);
        const runtime = await runtimeFor(user);
        // Recheck after asynchronous activation so revocation cannot race a request.
        const context = contextFor(request);
        const abort = new AbortController();
        const release = accounts.logins.track(login, abort);
        const signal = AbortSignal.any([request.signal, abort.signal]);
        try {
          signal.throwIfAborted();
          const response = await runtime.handle(new Request(request, { signal }), context);
          if (signal.aborted) {
            await response.body?.cancel();
            throw new HttpError(401, "account_unauthorized");
          }
          return remoteResponse(response, signal, release);
        } catch (error) {
          release();
          throw error;
        }
      } catch (error) {
        const response = errorResponse(error);
        response.headers.set("Cache-Control", "no-store");
        return response;
      }
    },
    authorizeVoice: (request: Request) => {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        throw new HttpError(403, "invalid_origin");
      return contextFor(request);
    },
    connectVoice: (socket: WebSocket, id: string, context: BusinessContext) => {
      const runtime = context.userId && runtimes.get(context.userId);
      if (!runtime) throw new HttpError(401, "account_unauthorized");
      void runtime
        .then((value) => value.voice.connect(socket, id, context))
        .catch(() => socket.close(1008, "account_unauthorized"));
    },
    trackVoice: (context: BusinessContext, socket: WebSocket) => {
      const login = accounts.logins.get(context.principal);
      const abort = new AbortController();
      abort.signal.addEventListener(
        "abort",
        () => {
          socket.close(1008, "account_unauthorized");
          void runtimes.get(login.userId)?.then((runtime) => runtime.voice.revoke(login.hash));
        },
        { once: true },
      );
      return accounts.logins.track(login, abort);
    },
    close: async () => {
      closing = true;
      try {
        await accounts.close();
        const results = await Promise.allSettled(
          [...runtimes.values()].map(async (runtime) => (await runtime).close()),
        );
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      } finally {
        await unlock();
      }
    },
  };
};
