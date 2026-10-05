import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import which from "which";
import { join } from "node:path";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { vi, expect, test } from "vitest";

import { PermissionPolicy } from "../permissions/policy";
import { createBashTool } from "../tools/bash";
import { sandboxLaunch } from "./launcher";

test("a failed runner probe never dispatches the requested command", async () => {
  if (process.platform !== "darwin" && process.platform !== "linux") return;
  const root = await mkdtemp(join(import.meta.dirname, ".probe-failure-test-"));
  const childProcess = await import("node:child_process");
  const spawn = vi.mocked(childProcess.spawn).mockImplementation((() => {
    const child = new EventEmitter();
    Object.assign(child, { stderr: Readable.from(["Runner refused profile"]), kill: () => {} });
    queueMicrotask(() => child.emit("close", 1));
    return child;
  }) as unknown as typeof childProcess.spawn);
  try {
    await expect(
      createBashTool(root).execute(
        { command: "echo forbidden > marker" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("SANDBOX_UNAVAILABLE");
    expect(await existsSync(join(root, "marker"))).toBe(false);
    expect(spawn.mock.calls.length).toBeLessThanOrEqual(1);
    if (spawn.mock.calls.length)
      expect(JSON.stringify(spawn.mock.calls[0])).not.toContain("forbidden");
  } finally {
    spawn.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});

test("real sandbox confines descendants, protected storage, temp and network; full access is explicit", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".sandbox-test-"));
  const work = join(root, "work");
  const storage = join(work, "state");
  await mkdir(storage, { recursive: true });
  const signal = new AbortController().signal;
  const tool = createBashTool(work, {
    permissionPreset: "workspace-write",
    protectedPaths: [storage],
  });
  const run = (command: string) => tool.execute({ command, timeout: 5 }, signal);
  const server = await serveTest({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response("unexpected access"),
  });
  try {
    if (process.platform !== "darwin" && process.platform !== "linux") {
      await expect(run("echo nope > marker")).rejects.toThrow("SANDBOX_UNAVAILABLE");
      expect(await existsSync(join(work, "marker"))).toBe(false);
      return;
    }
    await run("printf allowed > file; /bin/sh -c 'printf child > child-file'");
    expect(await readFile(join(work, "file"), "utf8")).toBe("allowed");
    expect(await readFile(join(work, "child-file"), "utf8")).toBe("child");
    await expect(run("/bin/sh -c 'printf denied > ../outside'")).rejects.toThrow();
    expect(await existsSync(join(root, "outside"))).toBe(false);
    await symlink(root, join(work, "outside-link"));
    await expect(run("printf denied > outside-link/escape")).rejects.toThrow();
    expect(await existsSync(join(root, "escape"))).toBe(false);
    await expect(run("printf denied > state/config")).rejects.toThrow();
    await expect(run("mv state moved-state")).rejects.toThrow();
    expect(await existsSync(join(storage, "config"))).toBe(false);
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
    expect(await existsSync(join(path, "file"))).toBe(false);
    const curl = await which("curl", { path: "/usr/bin:/bin", nothrow: true });
    if (!curl) throw new Error("Sandbox integration test requires curl");
    await expect(run(curl + " --silent --show-error --max-time 2 " + server.url)).rejects.toThrow();
    const readOnly = createBashTool(work);
    expect(JSON.stringify(await readOnly.execute({ command: "cat file" }, signal))).toContain(
      "allowed",
    );
    await expect(readOnly.execute({ command: "echo denied > file" }, signal)).rejects.toThrow();
    expect(await readFile(join(work, "file"), "utf8")).toBe("allowed");
    const full = createBashTool(work, { permissionPreset: "danger-full-access" });
    await full.execute({ command: "printf explicit > ../outside" }, signal);
    expect(await readFile(join(root, "outside"), "utf8")).toBe("explicit");
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

const serveTest = async (options: {
  hostname: string;
  port: number;
  fetch(request: Request): Response | Promise<Response>;
}) => {
  const server = createServer(getRequestListener(options.fetch));
  server.listen(options.port, options.hostname);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: new URL("http://127.0.0.1:" + address.port + "/"),
    stop: async (_force?: boolean) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  return { ...original, spawn: vi.fn(original.spawn) };
});
