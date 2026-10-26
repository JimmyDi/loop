import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";
import { VoiceResourceManager, VoiceRuntime } from "@loop/coding-agent";
import { WebSocket, WebSocketServer } from "ws";

import type { BusinessContext } from "../http/business-context";
import type { SessionRegistry } from "../session-registry";
import type { VoiceConnection, VoiceServerEvent } from "../../shared/voice";
import { VoiceService } from "./voice-service";

const engine = String.raw`
const readline = require("node:readline");
const send = (id, type, fields = {}) => process.stdout.write(JSON.stringify({v:1,id,type,...fields}) + "\n");
readline.createInterface({input:process.stdin}).on("line", (line) => {
  const c = JSON.parse(line);
  if (c.type === "configure") send(c.id,"ready");
  if (c.type === "audio") {
    if (c.samples === "//8=") {process.stdout.write("invalid\n");return;}
    send(c.id,"speech",{active:true});
    send(c.id,"transcript",{text:"partial",final:false});
    send(c.id,"completed");
  }
  if (c.type === "end") {
    send(c.id,"transcript",{text:"final text",final:true});
    send(c.id,"speech",{active:false});
    send(c.id,"completed");
  }
  if (c.type === "synthesize") setTimeout(() => {
    send(c.id,"audio",{samples:"AAA=",sampleRate:24000});
    send(c.id,"completed");
  },c.text === "slow" ? 60 : 0);
  if (c.type === "cancel") send(c.id,"completed");
  if (c.type === "close") {send(c.id,"completed");process.exit(0);}
});`;

type Client = { socket: WebSocket; events: VoiceServerEvent[]; audio: Buffer[] };

const owner: BusinessContext = { principal: "synthetic-device", remote: true };

const setup = async (resourceReady?: Promise<void>, engineSource = engine) => {
  const release = vi.fn();
  const runtime = new VoiceRuntime({
    resources: async () => {
      await resourceReady;
      return {
        release,
        resources: {
          executablePath: process.execPath,
          args: ["-e", engineSource],
          configuration: {
            asr: { encoder: "encoder", decoder: "decoder", joiner: "joiner", tokens: "tokens" },
            vad: { model: "vad" },
            tts: { model: "tts", voices: "voices", tokens: "tokens" },
          },
        },
      };
    },
  });
  const get = vi.fn(async () => ({ workspaceId: "workspace" }));
  const registry = { get, assertAvailable: vi.fn() } as unknown as SessionRegistry;
  const manager = new VoiceResourceManager(join(tmpdir(), "loop-voice-unused"));
  const service = new VoiceService(manager, registry, runtime);
  const server = createServer();
  const sockets = new WebSocketServer({ server });
  sockets.on("connection", (socket, request) => {
    const url = new URL(request.url!, "http://localhost");
    service.connect(socket, url.pathname.slice(1), {
      ...owner,
      principal: url.searchParams.get("owner") ?? owner.principal,
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing_address");
  const clients: Client[] = [];
  const connect = async (connection: VoiceConnection, principal = owner.principal) => {
    const socket = new WebSocket(
      "ws://127.0.0.1:" + address.port + "/" + connection.callId + "?owner=" + principal,
    );
    const client: Client = { socket, events: [], audio: [] };
    clients.push(client);
    socket.on("message", (data, binary) => {
      if (binary) client.audio.push(Buffer.from(data as Buffer));
      else client.events.push(JSON.parse(data.toString()));
    });
    await once(socket, "open");
    socket.send(JSON.stringify({ type: "authenticate", ticket: connection.ticket }));
    return client;
  };
  const close = async () => {
    await service.close();
    for (const client of clients) client.socket.terminate();
    for (const client of sockets.clients) client.terminate();
    await new Promise<void>((resolve) => sockets.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  return { service, runtime, release, connect, close, get };
};

const send = (client: Client, event: Record<string, unknown>) =>
  client.socket.send(JSON.stringify(event));

const ready = async (client: Client) => {
  await vi.waitFor(() => expect(client.events.some((event) => event.type === "ready")).toBe(true));
};

const disconnect = async (client: Client) => {
  const closed = once(client.socket, "close");
  client.socket.close();
  await closed;
};

test("voice service enforces a single owner, single-use connection ticket and device revocation", async () => {
  const fixture = await setup();
  try {
    const ticket = await fixture.service.start(owner, "tab", "conversation", "session");
    expect(fixture.get).toHaveBeenCalledWith("session");
    await expect(fixture.service.start(owner, "other", "test")).rejects.toThrow(
      "voice_call_active",
    );
    expect(() => fixture.service.reconnect(ticket.callId, owner, "other")).toThrow(
      "voice_call_owner",
    );
    await expect(
      fixture.service.stop(ticket.callId, { principal: "other", remote: true }, "tab"),
    ).rejects.toThrow("voice_call_owner");
    const client = await fixture.connect(ticket);
    await ready(client);
    expect(() => fixture.service.reconnect(ticket.callId, owner, "tab")).toThrow(
      "voice_call_connected",
    );
    const replay = await fixture.connect(ticket);
    await vi.waitFor(() => expect(replay.socket.readyState).toBe(WebSocket.CLOSED));
    expect(client.socket.readyState).toBe(WebSocket.OPEN);
    await fixture.service.revoke("other");
    expect(fixture.runtime.isActive).toBe(true);
    await fixture.service.revoke(owner.principal);
    await vi.waitFor(() => expect(client.socket.readyState).toBe(WebSocket.CLOSED));
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
  } finally {
    await fixture.close();
  }
});

test("mute and network restoration discard residual speech while preserving final and audio generation identity", async () => {
  const fixture = await setup();
  try {
    const ticket = await fixture.service.start(owner, "tab", "conversation", "session");
    const first = await fixture.connect(ticket);
    await ready(first);
    first.socket.send(Buffer.alloc(2));
    await vi.waitFor(() =>
      expect(first.events.some((event) => event.type === "transcript" && !event.final)).toBe(true),
    );
    send(first, { type: "configure", muted: true, readingPaused: false });
    send(first, { type: "configure", muted: false, readingPaused: false });
    first.socket.send(Buffer.alloc(2));
    send(first, { type: "finish" });
    await vi.waitFor(() =>
      expect(
        first.events.filter((event) => event.type === "transcript" && event.final),
      ).toHaveLength(1),
    );
    const original = first.events.find((event) => event.type === "transcript" && event.final);
    send(first, { type: "speak", generation: 0, text: "slow" });
    send(first, { type: "interrupt", generation: 1 });
    send(first, { type: "speak", generation: 1, text: "fresh" });
    await vi.waitFor(() => expect(first.audio).toHaveLength(1));
    expect(first.events.filter((event) => event.type === "audio")).toEqual([
      { type: "audio", generation: 1, sampleRate: 24000, format: "wav" },
    ]);
    expect(first.audio[0]?.subarray(0, 4).toString()).toBe("RIFF");
    await disconnect(first);
    let reconnect: VoiceConnection | undefined;
    await vi.waitFor(() => {
      reconnect = fixture.service.reconnect(ticket.callId, owner, "tab");
    });
    const second = await fixture.connect(reconnect!);
    await ready(second);
    expect(second.events.filter((event) => event.type === "transcript")).toEqual([]);
    second.socket.send(Buffer.alloc(2));
    send(second, { type: "finish" });
    await vi.waitFor(() =>
      expect(
        second.events.filter((event) => event.type === "transcript" && event.final),
      ).toHaveLength(1),
    );
    const next = second.events.find((event) => event.type === "transcript" && event.final);
    if (original?.type !== "transcript" || next?.type !== "transcript")
      throw new Error("missing_final");
    expect(next.utteranceId).not.toBe(original.utteranceId);
    expect(first.events.filter((event) => event.type === "transcript" && event.final)).toHaveLength(
      1,
    );
  } finally {
    await fixture.close();
  }
});

test("unexpected native failure clears the Web call so a replacement can start", async () => {
  const fixture = await setup();
  try {
    const ticket = await fixture.service.start(owner, "tab", "test");
    const client = await fixture.connect(ticket);
    await ready(client);
    client.socket.send(Buffer.from([255, 255]));
    await vi.waitFor(() => expect(client.socket.readyState).toBe(WebSocket.CLOSED));
    await vi.waitFor(() => expect(fixture.release).toHaveBeenCalledTimes(1));
    const replacement = await fixture.service.start(owner, "tab", "test");
    expect(replacement.callId).not.toBe(ticket.callId);
  } finally {
    await fixture.close();
  }
});

test("revocation before or during startup never issues a ticket or retains resources", async () => {
  const acquired = Promise.withResolvers<void>();
  const fixture = await setup(acquired.promise);
  try {
    const opening = fixture.service.start(owner, "tab", "test");
    const rejected = opening.catch((error: Error) => error.message);
    const revoked = fixture.service.revoke(owner.principal);
    acquired.resolve();
    await revoked;
    expect(await rejected).toMatch(/voice_call_closed|device_unauthorized/);
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
    await expect(fixture.service.start(owner, "tab", "test")).rejects.toThrow(
      "device_unauthorized",
    );
  } finally {
    acquired.resolve();
    await fixture.close();
  }
});

test("device expiry during startup rejects before ticket publication", async () => {
  const acquired = Promise.withResolvers<void>();
  const fixture = await setup(acquired.promise);
  try {
    const expiring = { ...owner, expiresAt: Date.now() + 50 };
    const opening = fixture.service.start(expiring, "tab", "test");
    const rejected = opening.catch((error: Error) => error.message);
    await new Promise<void>((resolve) => setTimeout(resolve, 70));
    acquired.resolve();
    expect(await rejected).toMatch(/voice_call_closed|device_unauthorized/);
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
    await expect(
      fixture.service.start({ ...owner, expiresAt: Date.now() - 1 }, "tab", "test"),
    ).rejects.toThrow("device_unauthorized");
  } finally {
    acquired.resolve();
    await fixture.close();
  }
});

test("aborting resource acquisition releases the opening call without issuing a ticket", async () => {
  const acquired = Promise.withResolvers<void>();
  const fixture = await setup(acquired.promise);
  const controller = new AbortController();
  try {
    const opening = fixture.service.start(owner, "tab", "test", undefined, controller.signal);
    const rejected = opening.catch((error: Error) => error.message);
    controller.abort();
    acquired.resolve();
    expect(await rejected).toMatch(/voice_call_closed|abort/i);
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
    const replacement = await fixture.service.start(owner, "tab", "test");
    expect(replacement.ticket).toBeTruthy();
  } finally {
    acquired.resolve();
    await fixture.close();
  }
});

test("aborting delayed session lookup prevents native startup", async () => {
  const fixture = await setup();
  const found = Promise.withResolvers<{ workspaceId: string }>();
  const controller = new AbortController();
  fixture.get.mockReturnValueOnce(found.promise);
  try {
    const opening = fixture.service.start(
      owner,
      "tab",
      "conversation",
      "session",
      controller.signal,
    );
    const rejected = opening.catch((error: Error) => error.name);
    controller.abort();
    found.resolve({ workspaceId: "workspace" });
    expect(await rejected).toBe("AbortError");
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).not.toHaveBeenCalled();
  } finally {
    found.resolve({ workspaceId: "workspace" });
    await fixture.close();
  }
});

test("HTTP cancellation stops native loading but cannot close an already established call", async () => {
  const fixture = await setup(
    undefined,
    engine.replace(
      'if (c.type === "configure") send(c.id,"ready");',
      'if (c.type === "configure") setTimeout(() => send(c.id,"ready"), 100);',
    ),
  );
  const loading = vi.spyOn(fixture.runtime, "startCall");
  try {
    const cancelled = new AbortController();
    const opening = fixture.service.start(owner, "tab", "test", undefined, cancelled.signal);
    const rejected = opening.catch((error: Error) => error.message);
    await vi.waitFor(() => expect(loading).toHaveBeenCalledTimes(1));
    cancelled.abort();
    expect(await rejected).toMatch(/voice_call_closed|abort/i);
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
    const completed = new AbortController();
    const ticket = await fixture.service.start(owner, "tab", "test", undefined, completed.signal);
    completed.abort();
    expect(fixture.runtime.isActive).toBe(true);
    const client = await fixture.connect(ticket);
    await ready(client);
    expect(fixture.release).toHaveBeenCalledTimes(1);
  } finally {
    await fixture.close();
  }
});

test("closing the service cancels resource startup and prevents a delayed session lookup starting inference", async () => {
  const acquired = Promise.withResolvers<void>();
  const fixture = await setup(acquired.promise);
  try {
    const opening = fixture.service.start(owner, "tab", "test");
    const rejected = opening.catch((error: Error) => error.message);
    const closing = fixture.service.close();
    acquired.resolve();
    await closing;
    expect(await rejected).toBe("voice_call_closed");
    expect(fixture.runtime.isActive).toBe(false);
    expect(fixture.release).toHaveBeenCalledTimes(1);
  } finally {
    acquired.resolve();
    await fixture.close();
  }
  const second = await setup();
  const found = Promise.withResolvers<{ workspaceId: string }>();
  second.get.mockReturnValueOnce(found.promise);
  try {
    const opening = second.service.start(owner, "tab", "conversation", "session");
    const rejected = opening.catch((error: Error) => error.message);
    await second.service.close();
    found.resolve({ workspaceId: "workspace" });
    expect(await rejected).toBe("voice_closed");
    expect(second.release).not.toHaveBeenCalled();
    expect(second.runtime.isActive).toBe(false);
  } finally {
    found.resolve({ workspaceId: "workspace" });
    await second.close();
  }
});

test("the real device expiry timer ends an established call and its native lease", async () => {
  const fixture = await setup();
  try {
    const ticket = await fixture.service.start(
      { ...owner, expiresAt: Date.now() + 200 },
      "tab",
      "test",
    );
    const client = await fixture.connect(ticket);
    await ready(client);
    await vi.waitFor(() => expect(client.socket.readyState).toBe(WebSocket.CLOSED));
    await vi.waitFor(() => {
      expect(fixture.runtime.isActive).toBe(false);
      expect(fixture.release).toHaveBeenCalledTimes(1);
    });
    expect(() => fixture.service.reconnect(ticket.callId, owner, "tab")).toThrow(
      "voice_call_expired",
    );
  } finally {
    await fixture.close();
  }
});
