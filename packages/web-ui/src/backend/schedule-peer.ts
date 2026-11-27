import { getRequestListener } from "@hono/node-server";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpsRequest } from "node:https";
import type { ConnectionOptions } from "node:tls";
import { join } from "node:path";
import { once } from "node:events";
import { Readable } from "node:stream";
import { HttpError, errorResponse } from "./http/errors";
import { readBody } from "./http/input";

// Both ends prove possession of the file's key before exchanging any schedule data.
// This also protects a client which reads a stale port after an owner crashes.
const tls = {
  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.2",
  ciphers: "PSK-AES256-GCM-SHA384",
} as const;

export const createSchedulePeer = (agentDir: string) => {
  const file = join(agentDir, "schedules", "owner.json");
  const listen = async (handle: (request: Request) => Promise<Response>) => {
    const key = randomBytes(32);
    const server = createServer(
      { ...tls, pskCallback: () => key },
      getRequestListener(async (request) => {
        try {
          return await handle(request);
        } catch (error) {
          return errorResponse(error);
        }
      }),
    );
    const stop = async () => {
      const closing = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await closing;
    };
    const temporary = file + "." + randomUUID() + ".tmp";
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing scheduler listener");
      await writeFile(temporary, JSON.stringify({ port: address.port, key: key.toString("hex") }), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporary, file);
      server.unref();
    } catch (error) {
      await stop();
      throw error;
    } finally {
      await rm(temporary, { force: true });
    }
    return async () => {
      try {
        await stop();
      } finally {
        await rm(file, { force: true });
      }
    };
  };
  const forward = async (request: Request, path: string, timeoutMs = 30_000) => {
    // Bodyless actions may arrive with an empty stream instead of a null body.
    const bodyless =
      request.method === "DELETE" ||
      (request.method === "POST" && /\/(pause|resume|cancel|archive|restore)$/.test(path));
    const body = !bodyless && request.body ? JSON.stringify(await readBody(request)) : undefined;
    try {
      const { port, key } = JSON.parse(await readFile(file, "utf8"));
      if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        typeof key !== "string" ||
        !/^[a-f0-9]{64}$/.test(key)
      )
        throw new Error();
      const authentication: ConnectionOptions = {
        ...tls,
        pskCallback: () => ({ identity: "scheduler", psk: Buffer.from(key, "hex") }),
        // This cipher authenticates with the shared key, so there is no certificate hostname.
        checkServerIdentity: () => undefined,
      };
      return await new Promise<Response>((resolve, reject) => {
        const upstream = httpsRequest(
          {
            ...authentication,
            host: "127.0.0.1",
            port,
            path,
            method: request.method,
            agent: false,
            signal: request.signal,
            headers: {
              ...(body ? { "Content-Type": "application/json" } : {}),
              ...(request.headers.has("last-event-id")
                ? { "Last-Event-ID": request.headers.get("last-event-id")! }
                : {}),
            },
          },
          (response) => {
            const contentType = response.headers["content-type"] ?? "application/json";
            const status = response.statusCode;
            const headers = { "Content-Type": contentType };
            if (contentType.startsWith("text/event-stream")) {
              clearTimeout(deadline);
              resolve(
                new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, {
                  status,
                  headers: {
                    ...headers,
                    "Cache-Control": "no-cache, no-transform",
                    "X-Accel-Buffering": "no",
                  },
                }),
              );
              return;
            }
            const chunks: Buffer[] = [];
            response.on("error", reject);
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              clearTimeout(deadline);
              resolve(
                new Response(chunks.length ? Buffer.concat(chunks) : null, { status, headers }),
              );
            });
          },
        );
        const deadline = setTimeout(
          () => upstream.destroy(new Error("Scheduler request timed out")),
          timeoutMs,
        );
        upstream.on("error", (error) => {
          clearTimeout(deadline);
          reject(error);
        });
        upstream.end(body);
      });
    } catch {
      throw new HttpError(
        503,
        "scheduler_unavailable",
        "Cannot reach the local scheduler. Refresh Automation, or restart the Loop host that owns it.",
      );
    }
  };
  return { listen, forward };
};
