import { expect, test, vi } from "vitest";

import { RemoteAccessController } from "../remote-access/controller";
import { remoteAccessRoutes } from "./remote-access";

test("local control mutations require exact origin and a process-local HttpOnly capability", async () => {
  const controller = new RemoteAccessController({
    supported: false,
    runtime: vi.fn(),
  });
  const route = remoteAccessRoutes(controller);
  const url = new URL("http://127.0.0.1:3080/api/remote-access");
  const status = await route(new Request(url), url);
  expect(await status!.json()).toEqual({
    supported: false,
    installed: false,
    signedIn: false,
    phase: "off",
  });
  const cookie = status!.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly; SameSite=Strict");
  expect(status!.headers.get("cache-control")).toBe("no-store");
  const call = (origin?: string, credential?: string, action = "login") =>
    route(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { origin } : {}),
          ...(credential ? { cookie: credential } : {}),
        },
        body: JSON.stringify({ action }),
      }),
      url,
    );
  await expect(call(undefined, cookie)).rejects.toMatchObject({ status: 403 });
  await expect(call("https://example.test", cookie)).rejects.toMatchObject({ status: 403 });
  await expect(call(url.origin)).rejects.toMatchObject({ status: 403 });
  await expect(call(url.origin, "loop_remote_control=" + "é".repeat(64))).rejects.toMatchObject({
    status: 403,
  });
  const response = await call(url.origin, cookie, "install");
  expect(response!.status).toBe(202);
  expect((await response!.json()).error).toBe("unsupported_platform");
  await expect(
    route(
      new Request(url, {
        method: "POST",
        headers: { origin: url.origin, cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", url: "https://example.test/tool" }),
      }),
      url,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(call(url.origin, cookie, "arbitrary")).rejects.toMatchObject({ status: 400 });
  for (const action of ["pause", "resume"]) {
    await expect(call(undefined, cookie, action)).rejects.toMatchObject({ status: 403 });
    await expect(call(url.origin, cookie, action)).rejects.toMatchObject({ status: 409 });
  }
  await expect(call(undefined, cookie, "uninstall")).rejects.toMatchObject({ status: 403 });
  expect((await call(url.origin, cookie, "uninstall"))!.status).toBe(202);
});

test("only entry refresh requests probe status; failures expose a fixed error", async () => {
  const controller = new RemoteAccessController({ supported: false, runtime: vi.fn() });
  const refresh = vi.spyOn(controller, "refresh");
  const route = remoteAccessRoutes(controller);
  const url = new URL("http://127.0.0.1:3080/api/remote-access");
  await route(new Request(url), url);
  expect(refresh).not.toHaveBeenCalled();
  url.searchParams.set("refresh", "1");
  const response = await route(new Request(url), url);
  expect(refresh).toHaveBeenCalledOnce();
  expect(response!.headers.get("set-cookie")).toContain("HttpOnly");
  refresh.mockRejectedValueOnce(new Error("synthetic-private-error"));
  await expect(route(new Request(url), url)).rejects.toMatchObject({
    status: 503,
    code: "remote_status_failed",
  });
});
