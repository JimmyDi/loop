import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { PermissionPolicy } from "../permissions/policy";
import { createBashTool } from "../tools/bash";
import { sandboxLaunch } from "./launcher";

test("a failed runner probe never dispatches the requested command", async () => {
  if (process.platform !== "darwin" && process.platform !== "linux") return;
  const root = await mkdtemp(join(import.meta.dir, ".probe-failure-test-"));
  const spawn = spyOn(Bun, "spawn").mockImplementation((() => ({
    exited: Promise.resolve(1),
    stderr: new Response("Runner refused profile").body,
    kill: () => {},
  })) as unknown as typeof Bun.spawn);
  try {
    await expect(
      createBashTool(root).execute(
        { command: "echo forbidden > marker" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("SANDBOX_UNAVAILABLE");
    expect(await Bun.file(join(root, "marker")).exists()).toBe(false);
    expect(spawn.mock.calls.length).toBeLessThanOrEqual(1);
    if (spawn.mock.calls.length)
      expect(JSON.stringify(spawn.mock.calls[0])).not.toContain("forbidden");
  } finally {
    spawn.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});

test("real sandbox confines descendants, protected storage, temp and network; full access is explicit", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".sandbox-test-"));
  const work = join(root, "work");
  const storage = join(work, "state");
  await mkdir(storage, { recursive: true });
  const signal = new AbortController().signal;
  const tool = createBashTool(work, {
    permissionPreset: "workspace-write",
    protectedPaths: [storage],
  });
  const run = (command: string) => tool.execute({ command, timeout: 5 }, signal);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("unexpected access"),
  });
  try {
    if (process.platform !== "darwin" && process.platform !== "linux") {
      await expect(run("echo nope > marker")).rejects.toThrow("SANDBOX_UNAVAILABLE");
      expect(await Bun.file(join(work, "marker")).exists()).toBe(false);
      return;
    }
    await run("printf allowed > file; /bin/sh -c 'printf child > child-file'");
    expect(await Bun.file(join(work, "file")).text()).toBe("allowed");
    expect(await Bun.file(join(work, "child-file")).text()).toBe("child");
    await expect(run("/bin/sh -c 'printf denied > ../outside'")).rejects.toThrow();
    expect(await Bun.file(join(root, "outside")).exists()).toBe(false);
    await symlink(root, join(work, "outside-link"));
    await expect(run("printf denied > outside-link/escape")).rejects.toThrow();
    expect(await Bun.file(join(root, "escape")).exists()).toBe(false);
    await expect(run("printf denied > state/config")).rejects.toThrow();
    await expect(run("mv state moved-state")).rejects.toThrow();
    expect(await Bun.file(join(storage, "config")).exists()).toBe(false);
    const missingStorage = createBashTool(work, {
      permissionPreset: "workspace-write",
      protectedPaths: [join(work, "missing-state")],
    });
    await expect(
      missingStorage.execute({ command: "mkdir missing-state" }, signal),
    ).rejects.toThrow();
    const temporary = await run('printf ok > "$TMPDIR/file"; printf "%s" "$TMPDIR"');
    const path = temporary[0]?.type === "text" ? temporary[0].text : "";
    expect(path).toContain("loop-bash-");
    expect(await Bun.file(join(path, "file")).exists()).toBe(false);
    const curl = Bun.which("curl", { PATH: "/usr/bin:/bin" });
    if (!curl) throw new Error("Sandbox integration test requires curl");
    await expect(run(curl + " --silent --show-error --max-time 2 " + server.url)).rejects.toThrow();
    const readOnly = createBashTool(work);
    expect(JSON.stringify(await readOnly.execute({ command: "cat file" }, signal))).toContain(
      "allowed",
    );
    await expect(readOnly.execute({ command: "echo denied > file" }, signal)).rejects.toThrow();
    expect(await Bun.file(join(work, "file")).text()).toBe("allowed");
    const full = createBashTool(work, { permissionPreset: "danger-full-access" });
    await full.execute({ command: "printf explicit > ../outside" }, signal);
    expect(await Bun.file(join(root, "outside")).text()).toBe("explicit");
    const policy = await new PermissionPolicy(work, {
      permissionPreset: "danger-full-access",
    }).resolve();
    expect(await sandboxLaunch(["test"], policy, signal)).toEqual({
      argv: ["test"],
      backend: "none",
    });
    await expect(sandboxLaunch(["test"], policy, AbortSignal.abort())).rejects.toThrow();
  } finally {
    server.stop(true);
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
