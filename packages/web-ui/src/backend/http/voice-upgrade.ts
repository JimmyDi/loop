import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";

import { HttpError } from "./errors";
import type {
  VoiceUpgradeAuthorization,
  VoiceUpgradeHandler,
  VoiceUpgradeTracker,
  VoiceUpgradeOptions,
} from "./voice-upgrade-types";

export const upgradeRequest = (request: IncomingMessage): Request => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers))
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  return new Request("http://" + (request.headers.host ?? "localhost") + request.url, { headers });
};

export const attachVoiceUpgrade = (
  server: Server,
  authorize: VoiceUpgradeAuthorization,
  handle: VoiceUpgradeHandler,
  track?: VoiceUpgradeTracker,
  options: VoiceUpgradeOptions = {},
) => {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 65_536,
    perMessageDeflate: false,
  });
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = request.url?.split("?")[0] ?? "";
    const protocol = request.headers["sec-websocket-protocol"];
    if (options.allowVite && path === "/" && (protocol === "vite-hmr" || protocol === "vite-ping"))
      return;
    try {
      const match = /^\/api\/voice\/calls\/([a-f0-9-]{36})\/socket$/.exec(path);
      if (!match || request.url?.includes("?")) throw new HttpError(404, "not_found");
      const context = authorize(upgradeRequest(request));
      sockets.handleUpgrade(request, socket, head, (client) => {
        try {
          const release = track?.(context, client);
          if (release) client.once("close", release);
          client.on("error", () => client.terminate());
          handle(client, match[1]!, context);
        } catch {
          client.close(1008, "voice_unauthorized");
        }
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 403;
      socket.end(
        "HTTP/1.1 " + status + " Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
        () => socket.destroy(),
      );
    }
  };
  server.on("upgrade", upgrade);
  return () => {
    server.off("upgrade", upgrade);
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  };
};
