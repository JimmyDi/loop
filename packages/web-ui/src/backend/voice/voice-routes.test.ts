import { expect, test, vi } from "vitest";

import { voiceRoutes } from "./voice-routes";
import type { VoiceService } from "./voice-service";

test("remote callers see no installation path and cannot manage resources", async () => {
  const install = vi.fn();
  const resources = {
    status: async () => ({
      supported: true,
      installed: true,
      phase: "idle",
      directory: "/synthetic-data/voice",
    }),
    install,
  };
  const { route } = voiceRoutes({ resources } as unknown as VoiceService);
  const context = { principal: crypto.randomUUID(), remote: true, expiresAt: Date.now() + 60_000 };
  const statusUrl = new URL("http://localhost/api/voice/status");
  expect(await (await route(new Request(statusUrl), statusUrl, context))?.json()).toEqual({
    supported: true,
    installed: true,
    phase: "idle",
    localManagement: false,
  });
  const installUrl = new URL("http://localhost/api/voice/install");
  await expect(
    route(
      new Request(installUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", profile: "input" }),
      }),
      installUrl,
      context,
    ),
  ).rejects.toThrow("local_only");
  expect(install).not.toHaveBeenCalled();
});

test("local commands require Origin and concurrent installs cannot overlap", async () => {
  const pending = Promise.withResolvers<void>();
  const install = vi.fn(() => pending.promise);
  const resources = {
    status: async () => ({
      supported: true,
      installed: false,
      phase: "idle",
      directory: "/synthetic-data/voice",
    }),
    install,
  };
  const routes = voiceRoutes({ resources } as unknown as VoiceService);
  const url = new URL("http://localhost/api/voice/install");
  const request = (origin?: string) =>
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ action: "install", profile: "input" }),
    });
  await expect(routes.route(request(), url)).rejects.toThrow("invalid_origin");
  expect((await routes.route(request(url.origin), url))?.status).toBe(202);
  await expect(routes.route(request(url.origin), url)).rejects.toThrow("voice_install_busy");
  expect(install).toHaveBeenCalledOnce();
  const context = { principal: "local", remote: false, origin: url.origin };
  const workerUrl = new URL("http://localhost:32123/api/voice/status");
  expect((await routes.route(new Request(workerUrl), workerUrl, context))?.status).toBe(200);
  routes.close();
  pending.resolve();
});

test("private worker validates POST against the gateway origin", async () => {
  const install = vi.fn(async () => {});
  const routes = voiceRoutes({
    resources: { status: async () => ({ phase: "idle" }), install },
  } as unknown as VoiceService);
  const url = new URL("http://127.0.0.1:32123/api/voice/install");
  const origin = "http://localhost:3080";
  const context = { principal: "local", remote: false, origin };
  const request = (source: string) =>
    new Request(url, {
      method: "POST",
      headers: { Origin: source, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "install", profile: "input" }),
    });
  await expect(routes.route(request(url.origin), url, context)).rejects.toThrow("invalid_origin");
  expect((await routes.route(request(origin), url, context))?.status).toBe(202);
  expect(install).toHaveBeenCalledOnce();
  routes.close();
});
