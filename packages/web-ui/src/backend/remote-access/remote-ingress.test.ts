import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { expect, test, vi } from "vitest";

import { DeviceStore } from "./device-store";
import { RemoteDevices } from "./remote-devices";
import { createRemoteHandler, startRemoteIngress } from "./remote-ingress";
import { deviceCookie, pairingCookie } from "./device-credentials";
import { eventResponse } from "../http/sse";
import { ListEvents } from "../list-events";

const origin = "https://example.test";

const setup = async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  vi.spyOn(store, "save").mockResolvedValue();
  const devices = new RemoteDevices(store);
  await devices.load();
  devices.connect(origin);
  return devices;
};

const credential = (response: Response) =>
  response.headers.get("set-cookie")!.split(";")[0]!.split("=")[1]!;

test("preserved public Host and Origin reach pairing over loopback without trusting relay rewrites", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-ingress-"));
  const devices = await setup();
  const business = vi.fn(async () => Response.json({ ok: true }));
  const ingress = await startRemoteIngress(devices, business, root);
  ingress.connected(origin);
  const local = "http://127.0.0.1:" + ingress.port;
  const call = (path: string, headers: Record<string, string>, body?: string) =>
    new Promise<Response>((resolve, reject) => {
      const request = httpRequest(
        local + path,
        { method: body ? "POST" : "GET", headers },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("error", reject);
          response.on("end", () =>
            resolve(new Response(Buffer.concat(chunks), { status: response.statusCode })),
          );
        },
      );
      request.on("error", reject);
      request.end(body);
    });
  try {
    await writeFile(join(root, "remote.html"), "<html><head></head><body>Loop</body></html>");
    for (const host of [new URL(origin).host, "127.0.0.1:" + ingress.port]) {
      const page = await call("/", { host });
      expect(page.status, host).toBe(200);
      expect(await page.text()).toContain('meta name="loop-remote"');
      const token = new URL(devices.invite().url).hash.slice(6);
      const request = await call(
        "/api/remote-pairing",
        { host, origin, "Content-Type": "application/json" },
        JSON.stringify({ token, name: "Example phone" }),
      );
      expect(request.status, host).toBe(202);
      expect((await call("/api/workspaces", { host })).status).toBe(401);
      expect(
        (await call("/api/remote-session", { host, origin: "https://other.test" })).status,
      ).toBe(403);
      for (const origin of ["http://localhost", "https://localhost"]) {
        const response = await call("/api/remote-session", { host, origin });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ code: "invalid_origin" });
      }
    }
    for (const host of [
      "localhost:" + (ingress.port + 1),
      "127.0.0.1:" + (ingress.port + 1),
      "[::1]:" + (ingress.port + 1),
      "localhost.other.test:" + ingress.port,
      "other.test",
      "localhost",
      "localhost:" + ingress.port,
      "127.0.0.1",
      "[::1]",
      "[::1]:" + ingress.port,
    ]) {
      const response = await call("/api/remote-session", {
        host,
        "x-forwarded-host": new URL(origin).host,
        forwarded: "host=" + new URL(origin).host,
      });
      expect(response.status, host).toBe(403);
      expect(await response.json()).toEqual({ code: "invalid_host" });
    }
    expect(business).not.toHaveBeenCalled();
  } finally {
    await ingress.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("unpaired ingress exposes only pairing and static bootstrap; exact origin and host are enforced", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-ingress-"));
  const devices = await setup();
  const business = vi.fn(async () => Response.json({ secret: "synthetic" }));
  const handle = createRemoteHandler(devices, business, root, () => "127.0.0.1:1234");
  const call = (path: string, init?: RequestInit) => handle(new Request(origin + path, init));
  try {
    await writeFile(join(root, "remote.html"), "<html><head></head><body>Loop</body></html>");
    const page = await call("/");
    expect(await page.text()).toContain('meta name="loop-remote"');
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(await (await call("/api/remote-session")).json()).toEqual({
      mode: "remote",
      authorized: false,
    });
    for (const path of [
      "/api/workspaces",
      "/api/sessions/example",
      "/api/models",
      "/api/settings/providers",
      "/api/remote-access/devices",
      "/api/workspaces/events",
    ]) {
      expect((await call(path)).status).toBe(401);
    }
    for (const headers of [
      { origin: "https://other.test" },
      { "sec-fetch-site": "cross-site" },
      { host: "other.test", "x-forwarded-host": "example.test" },
    ] as Record<string, string>[]) {
      expect((await call("/api/remote-session", { headers })).status).toBe(403);
    }
    expect(
      (
        await call("/api/remote-pairing", {
          method: "POST",
          headers: { "x-forwarded-origin": origin },
          body: "{}",
        })
      ).status,
    ).toBe(403);
    expect(business).not.toHaveBeenCalled();
    devices.connect();
    expect((await call("/")).status).toBe(503);
    expect((await call("/api/remote-session")).status).toBe(503);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("desktop approval exchanges a one-use invitation for HttpOnly cookies; CSRF gates business commands", async () => {
  const devices = await setup();
  const business = vi.fn(async () => Response.json({ ok: true }));
  const handle = createRemoteHandler(devices, business, "unused", () => "127.0.0.1:1234");
  const call = (path: string, init?: RequestInit) => handle(new Request(origin + path, init));
  const token = new URL(devices.invite().url).hash.slice(6);
  const init = {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ token, name: "Example phone" }),
  };
  const requested = await call("/api/remote-pairing", init);
  expect(requested.status).toBe(202);
  expect(requested.headers.get("set-cookie")).toContain(
    "Secure; HttpOnly; SameSite=Strict; Path=/",
  );
  const secret = credential(requested);
  expect(await requested.text()).not.toContain(secret);
  expect((await call("/api/remote-pairing", init)).status).toBe(403);
  const poll = () =>
    call("/api/remote-pairing", { headers: { cookie: pairingCookie + "=" + secret } });
  expect((await (await poll()).json()).state).toBe("pending");
  await devices.decide(devices.status().pending[0]!.id, true);
  const approved = await poll();
  expect(await approved.json()).toEqual({ state: "approved" });
  expect(approved.headers.get("set-cookie")).toContain(deviceCookie + "=" + secret);
  const cookie = deviceCookie + "=" + secret;
  const session = await (await call("/api/remote-session", { headers: { cookie } })).json();
  expect(session.authorized).toBe(true);
  expect(session.csrf).not.toBe(secret);
  expect((await call("/api/workspaces", { headers: { cookie } })).status).toBe(200);
  for (const headers of [
    { cookie, origin },
    { cookie, origin, "x-loop-csrf": "wrong" },
    { cookie, "x-loop-csrf": session.csrf },
  ] as Record<string, string>[]) {
    expect((await call("/api/sessions", { method: "POST", headers })).status).toBe(403);
  }
  const headers = { cookie, origin, "x-loop-csrf": session.csrf };
  expect((await call("/api/sessions", { method: "POST", headers, body: "{}" })).status).toBe(200);
  for (const path of [
    "/api/remote-access/pairing",
    "/api/settings",
    "/api/workspaces",
    "/api/directories/pick",
    "/api/settings/providers",
    "/api/settings/mcp",
  ]) {
    expect((await call(path, { method: "POST", headers })).status).toBe(403);
  }
  expect((await call("/api/settings/providers", { headers })).status).toBe(403);
  expect(
    (await call("/api/workspaces", { headers: { cookie: cookie + "; " + cookie } })).status,
  ).toBe(401);
  await devices.revoke(session.device.id);
  expect((await call("/api/workspaces", { headers: { cookie } })).status).toBe(401);
});

test.each(["revoke", "disconnect", "cancel"] as const)(
  "%s ends active SSE and its source subscription",
  async (action) => {
    const devices = await setup();
    const pending = devices.pairing.request(
      origin,
      new URL(devices.invite().url).hash.slice(6),
      "Phone",
    );
    await devices.decide(pending.pending.id, true);
    const events = new ListEvents();
    const original = events.connect.bind(events);
    const unsubscribe = vi.fn();
    const connect = vi.spyOn(events, "connect").mockImplementation((...args) => {
      const stop = original(...args);
      return () => {
        stop();
        unsubscribe();
      };
    });
    const ingress = await startRemoteIngress(
      devices,
      async (request) => eventResponse(events, request),
      "unused",
    );
    ingress.connected(origin);
    const abort = new AbortController();
    try {
      const response = await fetch("http://127.0.0.1:" + ingress.port + "/api/workspaces/events", {
        headers: { cookie: deviceCookie + "=" + pending.credential },
        signal: abort.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body!.getReader();
      expect((await reader.read()).done).toBe(false);
      expect(connect).toHaveBeenCalledOnce();
      if (action === "revoke") await devices.revoke(devices.authenticate(pending.credential).id);
      if (action === "disconnect") devices.connect();
      if (action === "cancel") abort.abort();
      if (action !== "cancel") expect((await reader.read()).done).toBe(true);
      await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalledOnce());
    } finally {
      abort.abort();
      await ingress.close();
    }
  },
);

test("business exceptions are sanitized and a revoked in-flight request cannot return data", async () => {
  const devices = await setup();
  const pairing = devices.pairing.request(
    origin,
    new URL(devices.invite().url).hash.slice(6),
    "Phone",
  );
  await devices.decide(pairing.pending.id, true);
  const cookie = deviceCookie + "=" + pairing.credential;
  const throwing = createRemoteHandler(
    devices,
    async () => {
      throw new Error("synthetic diagnostic");
    },
    "unused",
    () => "",
  );
  const error = await throwing(new Request(origin + "/api/workspaces", { headers: { cookie } }));
  expect(error.status).toBe(500);
  expect(await error.text()).not.toContain("diagnostic");
  let finish: ((response: Response) => void) | undefined;
  const delayed = createRemoteHandler(
    devices,
    async () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    "unused",
    () => "",
  );
  const result = delayed(new Request(origin + "/api/workspaces", { headers: { cookie } }));
  await vi.waitFor(() => expect(finish).toBeDefined());
  await devices.revoke(devices.authenticate(pairing.credential).id);
  finish!(Response.json({ secret: "synthetic" }));
  expect((await result).status).toBe(401);
});
