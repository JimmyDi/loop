import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { getProfileDir, SessionManager } from "@loop/coding-agent";
import { expect, test } from "vitest";

import { createAccountServer } from "./account-server";
import type { Account } from "../../shared/accounts";

test("authentication isolates projects, history, settings and live events without model calls", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".account-server-test-"));
  const app = await createAccountServer(root, root);
  const call = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
    origin = "http://localhost",
  ) =>
    app.handle(
      new Request("http://localhost/api" + path, {
        method,
        headers: {
          origin,
          cookie,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  try {
    expect((await call("/workspaces")).status).toBe(401);
    const setup = await call("/auth/register", "POST", {
      username: "owner",
      password: "synthetic-password",
    });
    const ownerCookie = setup.headers.get("set-cookie")!.split(";")[0]!;
    expect(setup.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    const owner = (await setup.json()).user as Account;
    const create = await call(
      "/auth/register",
      "POST",
      { username: "guest", password: "synthetic-password" },
      ownerCookie,
    );
    const user = (await create.json()).user as Account;
    const login = await call("/auth/login", "POST", {
      username: "guest",
      password: "synthetic-password",
    });
    const userCookie = login.headers.get("set-cookie")!.split(";")[0]!;
    expect((await call("/auth/users", "GET", undefined, userCookie)).status).toBe(404);
    expect(
      (await call("/settings/general", "PUT", {}, userCookie, "https://other.example")).status,
    ).toBe(403);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const privateSession = await SessionManager.create(
      projectRoot,
      join(getProfileDir(user.id, root), "sessions", "global"),
    );
    await privateSession.setTitle({
      text: "Private synthetic chat",
      source: "user",
      messageIndices: [],
    });
    await privateSession.commit([
      { role: "user", content: "Synthetic private input", timestamp: 1 },
    ]);
    expect((await call("/workspaces", "POST", { path: projectRoot }, userCookie)).status).toBe(200);
    expect(await (await call("/workspaces", "GET", undefined, ownerCookie)).json()).toEqual([]);
    const listed = await (
      await call("/sessions?scope=global", "GET", undefined, userCookie)
    ).json();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(privateSession.getSessionId());
    expect(
      await (await call("/sessions?scope=global", "GET", undefined, ownerCookie)).json(),
    ).toEqual([]);
    expect(
      (await call("/settings/general", "PUT", { permissionPreset: "workspace-write" }, userCookie))
        .status,
    ).toBe(200);
    expect(await (await call("/settings/general", "GET", undefined, ownerCookie)).json()).toEqual({
      permissionPreset: "read-only",
    });
    expect(
      (await call("/sessions/" + privateSession.getSessionId() + "/abort", "POST", {}, ownerCookie))
        .status,
    ).toBe(404);
    expect(() =>
      app.authorizeVoice(
        new Request("http://localhost/api/voice/calls/example/socket", {
          headers: { origin: "http://localhost" },
        }),
      ),
    ).toThrow();
    expect(
      (await call("/sessions/" + privateSession.getSessionId(), "GET", undefined, ownerCookie))
        .status,
    ).toBe(404);
    expect((await call("/voice/status", "GET", undefined, userCookie)).status).toBe(200);
    expect(
      (await (await call("/voice/status", "GET", undefined, userCookie)).json()).localManagement,
    ).toBe(true);
    expect(
      (await (await call("/voice/status", "GET", undefined, ownerCookie)).json()).localManagement,
    ).toBe(true);
    expect(
      (
        await call(
          "/auth/users/" + owner.id,
          "PATCH",
          { password: "synthetic-other-password" },
          userCookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call(
          "/auth/password",
          "POST",
          {
            currentPassword: "synthetic-password",
            password: "synthetic-other-password",
            userId: owner.id,
          },
          userCookie,
        )
      ).status,
    ).toBe(400);
    const events = await call("/workspaces/events", "GET", undefined, userCookie);
    expect(events.headers.get("content-type")).toContain("text/event-stream");
    const reader = events.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    const next = reader.read();
    let delivered = false;
    void next.then(() => {
      delivered = true;
    });
    await call("/workspaces", "POST", { path: root }, ownerCookie);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(delivered).toBe(false);
    expect((await call("/auth/logout", "POST", undefined, userCookie)).status).toBe(204);
    expect((await next).done).toBe(true);
    expect((await call("/workspaces", "GET", undefined, userCookie)).status).toBe(401);
    expect(
      await readFile(join(root, "users", user.id, "web-ui", "projects.json"), "utf8"),
    ).toContain(projectRoot);
    const relogin = await call("/auth/login", "POST", {
      username: "guest",
      password: "synthetic-password",
    });
    const reloginCookie = relogin.headers.get("set-cookie")!.split(";")[0]!;
    const changed = await call(
      "/auth/password",
      "POST",
      { currentPassword: "synthetic-password", password: "synthetic-new-password" },
      reloginCookie,
    );
    expect(changed.status).toBe(204);
    expect(changed.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await call("/workspaces", "GET", undefined, reloginCookie)).status).toBe(401);
    expect((await call("/workspaces", "GET", undefined, ownerCookie)).status).toBe(200);
    expect(
      (await call("/auth/login", "POST", { username: "guest", password: "synthetic-new-password" }))
        .status,
    ).toBe(200);
    expect(owner.id).not.toBe(user.id);
    await expect(createAccountServer(root, root)).rejects.toThrow("already owns");
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
    await rm(join(dirname(root), basename(root) + "-workspaces"), { recursive: true, force: true });
  }
});
