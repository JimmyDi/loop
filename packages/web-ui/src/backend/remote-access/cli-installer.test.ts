import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { CliInstaller } from "./cli-installer";
import { getCliRelease } from "./cli-release";

const directories: string[] = [];
const bytes = new TextEncoder().encode("synthetic executable bytes");
const release = {
  asset: "synthetic-cli",
  version: "test-version",
  url: "https://example.test/cli",
  sha256: createHash("sha256").update(bytes).digest("hex"),
};
const setup = async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-cli-test-"));
  directories.push(directory);
  return new CliInstaller(directory, release);
};

test("uninstall deletes only the managed executable, permits reinstall and handles missing files", async () => {
  const installer = await setup();
  const fetcher = vi.fn(async () => new Response(bytes));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await installer.uninstall();
  await installer.install(signal, () => {});
  const neighbor = join(dirname(installer.file), "unrelated-file");
  await writeFile(neighbor, "synthetic preserved content");
  await installer.uninstall();
  expect(await installer.installed()).toBe(false);
  expect(await readFile(neighbor, "utf8")).toBe("synthetic preserved content");
  await installer.uninstall();
  await installer.install(signal, () => {});
  expect(await installer.installed()).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("uninstall does not recursively delete unexpected directories and sanitizes errors", async () => {
  const installer = await setup();
  await mkdir(installer.file, { recursive: true });
  await writeFile(join(installer.file, "preserved"), "synthetic");
  await expect(installer.uninstall()).rejects.toMatchObject({
    code: "cli_uninstall_failed",
    message: "cli_uninstall_failed",
  });
  expect(await readdir(installer.file)).toEqual(["preserved"]);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("installs atomically, verifies existing executable and replaces tampered content", async () => {
  const installer = await setup();
  const fetch = vi.fn(
    async () => new Response(bytes, { headers: { "Content-Length": String(bytes.length) } }),
  );
  vi.stubGlobal("fetch", fetch);
  const progress = vi.fn();
  const signal = new AbortController().signal;
  await installer.install(signal, progress);
  expect(await readFile(installer.file)).toEqual(Buffer.from(bytes));
  expect(progress).toHaveBeenCalledWith({
    received: bytes.length,
    total: bytes.length,
    paused: false,
  });
  expect(await installer.installed()).toBe(true);
  await installer.install(signal, progress);
  expect(fetch).toHaveBeenCalledOnce();
  await writeFile(installer.file, "tampered");
  expect(await installer.installed()).toBe(false);
  await installer.install(signal, progress);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await readdir(dirname(installer.file))).toHaveLength(1);
});

test("rejects wrong digest without installing or leaving download files", async () => {
  const installer = await setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("wrong bytes")),
  );
  await expect(installer.install(new AbortController().signal, () => {})).rejects.toMatchObject({
    code: "cli_integrity_failed",
  });
  expect(await installer.installed()).toBe(false);
  expect(await readdir(dirname(installer.file))).toEqual([]);
});

test.each([false, true])(
  "reports verification before installation and disables pause; known total=%s",
  async (knownTotal) => {
    const installer = await setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(bytes, {
            headers: knownTotal ? { "Content-Length": String(bytes.length) } : undefined,
          }),
      ),
    );
    let verifying = false;
    let installedDuringVerification: Promise<boolean> | undefined;
    await installer.install(new AbortController().signal, (progress) => {
      if (progress.stage !== "verifying") return;
      verifying = true;
      expect(progress).toMatchObject({ received: bytes.length, paused: false });
      expect(progress.total).toBe(knownTotal ? bytes.length : undefined);
      expect(installer.pause(true)).toBe(false);
      expect(installer.pause(false)).toBe(false);
      installedDuringVerification = installer.installed();
    });
    expect(verifying).toBe(true);
    expect(await installedDuringVerification).toBe(false);
    expect(await installer.installed()).toBe(true);
  },
);

test("cancellation during verification deletes the temporary file without installing", async () => {
  const installer = await setup();
  const abort = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
  await expect(
    installer.install(abort.signal, ({ stage }) => {
      if (stage === "verifying") abort.abort();
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(await installer.installed()).toBe(false);
  expect(await readdir(dirname(installer.file))).toEqual([]);
});

test("cancellation removes incomplete executable and does not execute anything", async () => {
  const installer = await setup();
  const abort = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes)),
  );
  await expect(installer.install(abort.signal, () => abort.abort())).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(await installer.installed()).toBe(false);
  expect(await readdir(dirname(installer.file))).toEqual([]);
});

test("release allowlist pins supported platforms and rejects unsupported targets", () => {
  for (const [platform, arch] of [
    ["darwin", "x64"],
    ["darwin", "arm64"],
    ["linux", "x64"],
    ["linux", "arm64"],
    ["win32", "x64"],
  ] as const) {
    const entry = getCliRelease(platform, arch);
    expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.url).toContain("/cli/" + entry.version + "/");
  }
  expect(() => getCliRelease("linux", "ia32")).toThrow("unsupported_platform");
});

test("stopping a paused download deletes partial bytes and retry starts from zero", async () => {
  const installer = await setup();
  const abort = new AbortController();
  let partial = true;
  const fetcher = vi.fn(async () =>
    partial
      ? new Response(bytes.slice(0, 4), { headers: { "Content-Length": String(bytes.length) } })
      : new Response(bytes),
  );
  vi.stubGlobal("fetch", fetcher);
  const running = installer.install(abort.signal, ({ received, paused }) => {
    if (received === 4 && !paused) installer.pause(true);
  });
  const rejected = expect(running).rejects.toMatchObject({ name: "AbortError" });
  try {
    await vi.waitFor(async () => {
      const entries = await readdir(dirname(installer.file));
      expect(entries).toHaveLength(1);
      expect(await readFile(join(dirname(installer.file), entries[0]!))).toEqual(
        Buffer.from(bytes.slice(0, 4)),
      );
    });
    abort.abort();
    await rejected;
    expect(await readdir(dirname(installer.file))).toEqual([]);
    expect(installer.pause(false)).toBe(false);
    partial = false;
    await installer.install(new AbortController().signal, () => {});
    expect(await installer.installed()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]).toBeTruthy();
  } finally {
    abort.abort();
    await running.catch(() => {});
  }
});

test.each([false, true])(
  "resumed bytes require full digest verification; tampered=%s",
  async (tampered) => {
    const installer = await setup();
    const abort = new AbortController();
    let pausedOnce = false;
    const fetcher = vi.fn(async () =>
      fetcher.mock.calls.length === 1
        ? new Response(bytes.slice(0, 4), { headers: { "Content-Length": String(bytes.length) } })
        : new Response(tampered ? new Uint8Array(bytes.length - 4) : bytes.slice(4), {
            status: 206,
            headers: { "Content-Range": "bytes 4-" + (bytes.length - 1) + "/" + bytes.length },
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    const running = installer.install(abort.signal, ({ received }) => {
      if (received !== 4 || pausedOnce) return;
      pausedOnce = true;
      installer.pause(true);
    });
    try {
      await vi.waitFor(() => expect(pausedOnce).toBe(true));
      expect(await installer.installed()).toBe(false);
      expect(installer.pause(false)).toBe(true);
      if (tampered) await expect(running).rejects.toMatchObject({ code: "cli_integrity_failed" });
      else await running;
      expect(await installer.installed()).toBe(!tampered);
      expect(await readdir(dirname(installer.file))).toHaveLength(tampered ? 0 : 1);
    } finally {
      abort.abort();
      await running.catch(() => {});
    }
  },
);
