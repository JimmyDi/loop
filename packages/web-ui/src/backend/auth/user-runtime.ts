import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getProfileDir } from "@loop/coding-agent";
import type { VoiceResourceManager } from "@loop/coding-agent";

import { createProfileService } from "../profile-service";
import { createRouter } from "../router";
import { createRemoteAccess } from "../remote-access/create-remote-access";
import { DeviceStore } from "../remote-access/device-store";
import { RemoteDevices } from "../remote-access/remote-devices";
import { startRemoteIngress } from "../remote-access/remote-ingress";
import type { Accounts } from "./accounts";
import type { Account } from "../../shared/accounts";
import type { BusinessContext } from "../http/business-context";
import type { BusinessWorker } from "./business-worker";

export const createUserRuntime = async (
  root: string,
  user: Account,
  assets: string,
  resources: VoiceResourceManager,
  accounts: Accounts,
  worker?: BusinessWorker,
) => {
  const agentDir = getProfileDir(user.id, root);
  await mkdir(agentDir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") await chmod(agentDir, 0o700);
  const devices = new RemoteDevices(
    new DeviceStore(join(agentDir, "web-ui", "remote-access", "devices.json")),
  );
  await devices.load();
  const local = createProfileService(root, user.id, resources);
  const activeVoice = worker ? { connect: worker.voice, revoke: worker.revokeVoice } : local.voice;
  const unsubscribe = devices.subscribeInvalidation(activeVoice.revoke);
  const business = worker?.handle ?? local.handle;
  const remoteBusiness = async (request: Request, context?: BusinessContext) => {
    const current = accounts.users.get(user.id);
    accounts.assertAvailable(user.id);
    if (new URL(request.url).pathname === "/api/auth/session" && request.method === "GET")
      return Response.json({ user: current });
    return business(request, { ...context!, userId: user.id });
  };
  try {
    const remoteAccess = await createRemoteAccess(
      agentDir,
      (port) =>
        startRemoteIngress(
          devices,
          remoteBusiness,
          assets,
          port,
          undefined,
          (socket, id, context) => activeVoice.connect(socket, id, { ...context, userId: user.id }),
        ),
      root,
    );
    const route = createRouter(
      local.registry,
      local.providers,
      local.settings,
      local.mcp,
      local.skills,
      remoteAccess,
      devices,
      local.voice,
      business,
    );
    return {
      voice: activeVoice,
      invalidate: async () => {
        devices.connect();
        for (const device of [...devices.status().devices, ...devices.status().expiredDevices])
          await devices.revoke(device.id);
      },
      handle: (request: Request, context: BusinessContext) => route(request, context),
      close: async () => {
        unsubscribe();
        try {
          await remoteAccess.close();
        } finally {
          await local.close();
        }
      },
    };
  } catch (error) {
    unsubscribe();
    await local.close();
    throw error;
  }
};

export type UserRuntime = Awaited<ReturnType<typeof createUserRuntime>>;
