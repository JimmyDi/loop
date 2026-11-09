import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { Accounts } from "./accounts";

const request = (token: string) =>
  new Request("http://localhost/api/auth/session", { headers: { cookie: "loop_login=" + token } });

test("accounts persist hashes, preserve logins across restart and revoke only after verifying the current password", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".accounts-test-"));
  const first = new Accounts(root);
  let restarted: Accounts | undefined;
  try {
    await first.load();
    await first.login("OWNER", "synthetic-owner-password", true);
    const login = await first.login("guest", "synthetic-guest-password", true);
    const user = login.user;
    await expect(first.login("guest", "synthetic-password", true)).rejects.toMatchObject({
      status: 409,
    });
    await expect(first.login("guest", "incorrect-password")).rejects.toMatchObject({ status: 401 });
    const persisted = await readFile(join(root, "auth", "users.json"), "utf8");
    expect(persisted).not.toContain("synthetic-guest-password");
    expect(JSON.parse(persisted).users[0].password.salt).not.toBe(
      JSON.parse(persisted).users[1].password.salt,
    );
    expect(await readFile(join(root, "auth", "login-sessions.json"), "utf8")).not.toContain(
      login.token,
    );
    restarted = new Accounts(root);
    await restarted.load();
    expect(restarted.authenticate(request(login.token)).user.id).toBe(user.id);
    const abort = new AbortController();
    const release = restarted.logins.track(
      restarted.authenticate(request(login.token)).login,
      abort,
    );
    await expect(
      restarted.changePassword(
        request(login.token),
        "wrong-password",
        "synthetic-replacement-password",
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(restarted.authenticate(request(login.token)).user.id).toBe(user.id);
    await expect(
      restarted.changePassword(request(login.token), "synthetic-guest-password", "short"),
    ).rejects.toMatchObject({ status: 400 });
    expect(restarted.authenticate(request(login.token)).user.id).toBe(user.id);
    await restarted.changePassword(
      request(login.token),
      "synthetic-guest-password",
      "synthetic-replacement-password",
    );
    expect(abort.signal.aborted).toBe(true);
    release();
    expect(() => restarted!.authenticate(request(login.token))).toThrow();
    const next = await restarted.login("guest", "synthetic-replacement-password");
    expect(next.user.id).toBe(user.id);
    await expect(restarted.login("guest", "synthetic-guest-password")).rejects.toMatchObject({
      status: 401,
    });
  } finally {
    first.logins.close();
    restarted?.logins.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("corrupt account and login files fail closed and duplicate registration is serialized", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".accounts-test-"));
  const accounts = new Accounts(root);
  try {
    await accounts.load();
    const results = await Promise.allSettled([
      accounts.login("first", "synthetic-password", true),
      accounts.login("first", "synthetic-password", true),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(JSON.parse(await readFile(join(root, "auth", "users.json"), "utf8")).users).toHaveLength(
      1,
    );
    await writeFile(join(root, "auth", "login-sessions.json"), "{}");
    await expect(new Accounts(root).load()).rejects.toThrow("Invalid login storage");
    await writeFile(join(root, "auth", "users.json"), "{");
    await expect(new Accounts(root).load()).rejects.toThrow("Invalid account storage");
  } finally {
    accounts.logins.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("fixed expiry and login throttling deny expired or excessive credentials", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".accounts-test-"));
  const accounts = new Accounts(root);
  try {
    await accounts.load();
    const login = await accounts.login("owner", "synthetic-password", true);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 24 * 60 * 60 * 1000);
    try {
      expect(() => accounts.authenticate(request(login.token))).toThrow();
    } finally {
      clock.mockRestore();
    }
    for (let index = 0; index < 9; index++)
      await accounts.login("owner", "synthetic-password", false);
    expect(() => accounts.login("owner", "synthetic-password", false)).toThrow(
      "login_rate_limited",
    );
  } finally {
    accounts.logins.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("shutdown drains accepted account writes before releasing storage", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".accounts-test-"));
  const accounts = new Accounts(root);
  const restarted = new Accounts(root);
  try {
    await accounts.load();
    const pending = accounts.login("owner", "synthetic-password", true);
    await accounts.close();
    const login = await pending;
    await expect(accounts.login("owner", "synthetic-password", false)).rejects.toMatchObject({
      status: 503,
    });
    await restarted.load();
    expect(restarted.authenticate(request(login.token)).user.username).toBe("owner");
  } finally {
    await accounts.close();
    await restarted.close();
    await rm(root, { recursive: true, force: true });
  }
});
