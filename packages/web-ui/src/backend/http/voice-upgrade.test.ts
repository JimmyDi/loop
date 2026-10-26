import { once } from "node:events";
import { createConnection } from "node:net";
import { expect, test, vi } from "vitest";
import { WebSocket } from "ws";

import { createHttpServer, listen } from "./node-server";
import { attachVoiceUpgrade } from "./voice-upgrade";
import { assertLocalRequest } from "./local-request";
import { localContext } from "./business-context";

test("voice upgrades enforce Origin and explicitly terminate upgraded sockets at shutdown", async () => {
  const server = createHttpServer(() => new Response("http"));
  const closeVoice = attachVoiceUpgrade(
    server,
    (request) => {
      assertLocalRequest(request);
      return localContext;
    },
    (socket) => socket.send("ready"),
  );
  const url = await listen(server, 0);
  const address =
    url.href.replace("http:", "ws:") + "api/voice/calls/" + crypto.randomUUID() + "/socket";
  let socket: WebSocket | undefined;
  try {
    const denied = new WebSocket(address, { origin: "https://example.com" });
    await expect(once(denied, "open")).rejects.toThrow("403");
    socket = new WebSocket(address, { origin: url.origin });
    const message = once(socket, "message");
    await once(socket, "open");
    expect((await message)[0].toString()).toBe("ready");
    const closed = once(socket, "close");
    closeVoice();
    await closed;
  } finally {
    socket?.terminate();
    closeVoice();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test.each([false, true])(
  "unknown upgrades close rather than leaving an unauthenticated socket (development: %s)",
  async (allowVite) => {
    const server = createHttpServer(() => new Response("http"));
    const closeVoice = attachVoiceUpgrade(
      server,
      () => localContext,
      () => {},
      undefined,
      {
        allowVite,
      },
    );
    const url = await listen(server, 0);
    const clients: WebSocket[] = [];
    try {
      for (const [path, protocol] of [
        ["/api/unknown", undefined],
        ["/unknown", "vite-hmr"],
        ["/", undefined],
        ...(!allowVite ? [["/", "vite-hmr"]] : []),
      ]) {
        const client = new WebSocket(new URL(path!, url).href.replace("http:", "ws:"), protocol);
        clients.push(client);
        const closed = new Promise<void>((resolve) => client.once("close", () => resolve()));
        await expect(once(client, "open")).rejects.toThrow("404");
        await closed;
        expect(client.readyState).toBe(WebSocket.CLOSED);
      }
    } finally {
      for (const client of clients) client.terminate();
      closeVoice();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);

test("development delegates only Vite's root HMR upgrades to its own handler", async () => {
  const server = createHttpServer(() => new Response("http"));
  const closeVoice = attachVoiceUpgrade(
    server,
    () => localContext,
    () => {},
    undefined,
    {
      allowVite: true,
    },
  );
  const { createServer } = await import("vite");
  const frontend = await createServer({
    configFile: false,
    root: import.meta.dirname,
    server: { middlewareMode: true, hmr: { server } },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  let client: WebSocket | undefined;
  try {
    const url = await listen(server, 0);
    client = new WebSocket(url.href.replace("http:", "ws:"), "vite-hmr");
    const message = once(client, "message");
    await once(client, "open");
    expect(JSON.parse((await message)[0].toString())).toEqual({ type: "connected" });
  } finally {
    client?.terminate();
    closeVoice();
    await frontend.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("rejected upgrades release peers that keep their write side open", async () => {
  const server = createHttpServer(() => new Response("http"));
  const closeVoice = attachVoiceUpgrade(
    server,
    () => localContext,
    () => {},
  );
  const url = await listen(server, 0);
  const accepted = once(server, "connection");
  const client = createConnection({
    host: url.hostname,
    port: Number(url.port),
    allowHalfOpen: true,
  });
  client.on("data", () => {});
  try {
    const [peer] = await accepted;
    const ended = once(client, "end");
    client.write(
      "GET /unknown HTTP/1.1\r\nHost: " +
        url.host +
        "\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n",
    );
    await ended;
    expect(client.writableEnded).toBe(false);
    await vi.waitFor(() => expect(peer.destroyed).toBe(true));
  } finally {
    client.destroy();
    closeVoice();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
