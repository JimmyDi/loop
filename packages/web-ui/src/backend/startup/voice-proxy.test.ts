import { once } from "node:events";
import { expect, test } from "vitest";
import { WebSocket } from "ws";

import { createHttpServer, listen } from "../http/node-server";
import { attachVoiceUpgrade } from "../http/voice-upgrade";
import { localContext, readContext } from "../http/business-context";
import { createVoiceProxy } from "./voice-proxy";

test("the private development voice proxy preserves binary frames and trusted identity", async () => {
  const worker = createHttpServer(() => new Response(null, { status: 404 }));
  const closeWorker = attachVoiceUpgrade(
    worker,
    (request) => {
      expect(request.headers.get("authorization")).toBe("Bearer fixture");
      return readContext(request.headers);
    },
    (socket, _id, context) => {
      expect(context).toEqual(localContext);
      socket.on("message", (data, binary) => socket.send(data, { binary }));
    },
  );
  const workerUrl = await listen(worker, 0);
  const gateway = createHttpServer(() => new Response(null, { status: 404 }));
  const closeGateway = attachVoiceUpgrade(
    gateway,
    () => localContext,
    createVoiceProxy(() => ({ port: Number(workerUrl.port), token: "fixture" })),
  );
  const gatewayUrl = await listen(gateway, 0);
  const socket = new WebSocket(
    gatewayUrl.href.replace("http:", "ws:") + "api/voice/calls/" + crypto.randomUUID() + "/socket",
  );
  try {
    await once(socket, "open");
    const response = once(socket, "message");
    socket.send(Buffer.from([1, 2, 3, 4]));
    const [bytes, binary] = await response;
    expect(binary).toBe(true);
    expect(bytes).toEqual(Buffer.from([1, 2, 3, 4]));
  } finally {
    socket.terminate();
    closeGateway();
    closeWorker();
    await Promise.all(
      [worker, gateway].map(
        (server) => new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
});

test("development voice heartbeat waits for the browser pong rather than proxy auto-pong", async () => {
  const worker = createHttpServer(() => new Response(null, { status: 404 }));
  const attached = Promise.withResolvers<WebSocket>();
  const closeWorker = attachVoiceUpgrade(
    worker,
    () => localContext,
    (socket) => attached.resolve(socket),
  );
  const workerUrl = await listen(worker, 0);
  const gateway = createHttpServer(() => new Response(null, { status: 404 }));
  const closeGateway = attachVoiceUpgrade(
    gateway,
    () => localContext,
    createVoiceProxy(() => ({ port: Number(workerUrl.port), token: "fixture" })),
  );
  const gatewayUrl = await listen(gateway, 0);
  const client = new WebSocket(
    gatewayUrl.href.replace("http:", "ws:") + "api/voice/calls/" + crypto.randomUUID() + "/socket",
    { autoPong: false },
  );
  try {
    await once(client, "open");
    const upstream = await attached.promise;
    let pongs = 0;
    upstream.on("pong", () => pongs++);
    const ping = once(client, "ping");
    upstream.ping("heartbeat");
    const [data] = await ping;
    expect(pongs).toBe(0);
    const pong = once(upstream, "pong");
    client.pong(data);
    expect((await pong)[0].toString()).toBe("heartbeat");
    expect(pongs).toBe(1);
  } finally {
    client.terminate();
    closeGateway();
    closeWorker();
    await Promise.all(
      [worker, gateway].map(
        (server) => new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
});
