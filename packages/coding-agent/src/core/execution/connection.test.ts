import { mkdtempSync, readFileSync, rmSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { spawnSync } from "node:child_process";

import {
  saveSandboxConnection,
  sandboxConfiguration,
  sandboxToken,
  sandboxUrl,
} from "./connection";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "loop-credentials-"));
  vi.stubEnv("LOOP_DATA_DIR", directory);
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "");
  vi.stubEnv("LOOP_SANDBOX_URL", "");
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("private saved connection supports CLI/Web and resolves credentials without persisting them in sessions", () => {
  saveSandboxConnection("http://localhost:8080", "synthetic-first", true);
  const config = sandboxConfiguration()!;
  expect(config).toEqual({
    type: "sandbox",
    url: "http://localhost:8080/mcp/",
    tokenEnv: "LOOP_SANDBOX_TOKEN",
  });
  expect(JSON.stringify(config)).not.toContain("synthetic-first");
  expect(sandboxToken(config)).toBe("synthetic-first");
  expect(statSync(join(directory, "sandbox-connection.json")).mode & 0o777).toBe(0o600);
  saveSandboxConnection(config.url, "synthetic-rotated", true);
  expect(sandboxToken(config)).toBe("synthetic-rotated");
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "synthetic-env");
  expect(sandboxToken(config)).toBe("synthetic-env");
  vi.stubEnv("LOOP_SANDBOX_TOKEN", "");
  expect(() => sandboxToken({ ...config, url: "https://different.example/mcp/" })).toThrow(
    /missing/,
  );
  expect(() => sandboxToken({ ...config, tokenEnv: "CUSTOM_TEST_CREDENTIAL" })).toThrow(/missing/);
});

test("keychain receives secrets through stdin and stores only a reference in configuration", () => {
  const runner = vi.mocked(spawnSync);
  runner.mockReturnValue({
    status: 0,
    stdout: "synthetic-keychain-token\n",
    stderr: "",
    pid: 0,
    output: [],
    signal: null,
  });
  if (!["darwin", "linux"].includes(process.platform)) return;
  saveSandboxConnection("https://sandbox.example/mcp/", "synthetic-keychain-token");
  const config = sandboxConfiguration()!;
  expect(sandboxToken(config)).toBe("synthetic-keychain-token");
  const disk = readFileSync(join(directory, "sandbox-connection.json"), "utf8");
  expect(disk).not.toContain("synthetic-keychain-token");
  expect(disk).toContain('"store":"keychain"');
  for (const call of runner.mock.calls) {
    expect(JSON.stringify(call[1])).not.toContain("synthetic-keychain-token");
    expect(JSON.stringify(call[1])).not.toContain(
      Buffer.from("synthetic-keychain-token").toString("hex"),
    );
  }
  expect(runner.mock.calls.some((call) => Boolean((call[2] as { input?: string })?.input))).toBe(
    true,
  );
});

test("keychain failure does not silently store plaintext", () => {
  vi.mocked(spawnSync).mockReturnValue({
    status: 1,
    stdout: "",
    stderr: "unavailable",
    pid: 0,
    output: [],
    signal: null,
  });
  expect(() => saveSandboxConnection("https://sandbox.example/", "synthetic-token")).toThrow(
    /credential store/,
  );
  expect(sandboxConfiguration()).toBeUndefined();
});

test("rejects unsafe URLs and exposed credential files", () => {
  for (const url of [
    "http://remote.example/",
    "https://user:password@example.test/",
    "https://example.test/?token=synthetic",
    "file:///tmp/test",
  ])
    expect(() => sandboxUrl(url)).toThrow();
  saveSandboxConnection("http://localhost:8080/mcp", "synthetic-private", true);
  chmodSync(join(directory, "sandbox-connection.json"), 0o644);
  if (process.platform !== "win32") expect(() => sandboxConfiguration()).toThrow(/private/);
});
