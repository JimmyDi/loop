import { execFileSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));

const originalArgv = process.argv;
const originalPlatform = process.platform;

const configure = (platform: string, skipPlatformSigning: boolean) => {
  vi.resetModules();
  vi.clearAllMocks();
  Object.defineProperty(process, "platform", { value: platform });
  process.argv = ["node", "bundle-release.ts", platform === "darwin" ? "app,dmg" : "nsis"];
  if (skipPlatformSigning) process.argv.push("--no-platform-signing");
  for (const name of [
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_SIGNING_IDENTITY",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
    "WINDOWS_CERTIFICATE",
    "WINDOWS_CERTIFICATE_PASSWORD",
  ])
    vi.stubEnv(name, "");
  vi.stubEnv("npm_execpath", "pnpm.cjs");
  vi.stubEnv("LOOP_UPDATER_URL", "https://example.com/stable.json");
  vi.stubEnv("LOOP_UPDATER_PUBLIC_KEY", "synthetic-public-key");
  vi.stubEnv("TAURI_SIGNING_PRIVATE_KEY", "synthetic-private-key");
  vi.mocked(readFile).mockResolvedValue(
    JSON.stringify({
      version: "0.9.0",
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: { endpoints: ["https://example.com/stable.json"], pubkey: "synthetic-public-key" },
      },
    }),
  );
};

afterEach(() => {
  process.argv = originalArgv;
  Object.defineProperty(process, "platform", { value: originalPlatform });
  vi.unstubAllEnvs();
});

test.each(["darwin", "win32"])(
  "%s bundles update-enabled releases without platform certificates",
  async (platform) => {
    configure(platform, true);
    await import("./bundle-release");
    const calls = vi.mocked(execFileSync).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.slice(0, 2)).toEqual([process.execPath, ["pnpm.cjs", "build"]]);
    expect(calls[1]?.slice(0, 2)).toEqual([
      process.execPath,
      [
        "pnpm.cjs",
        "tauri",
        "build",
        "--config",
        ".tools/tauri-build.json",
        "--bundles",
        platform === "darwin" ? "app,dmg" : "nsis",
      ],
    ]);
    expect(writeFile).toHaveBeenCalledTimes(1);
    const config = JSON.parse(String(vi.mocked(writeFile).mock.calls[0]?.[1]));
    expect(config.bundle).toEqual({ createUpdaterArtifacts: true });
    expect(config.plugins.updater.pubkey).toBe("synthetic-public-key");
    expect(rm).toHaveBeenCalledTimes(2);
  },
);

test.each(["LOOP_UPDATER_URL", "LOOP_UPDATER_PUBLIC_KEY", "TAURI_SIGNING_PRIVATE_KEY"])(
  "certificate-free releases still require %s",
  async (name) => {
    configure("darwin", true);
    vi.stubEnv(name, "");
    await expect(import("./bundle-release")).rejects.toThrow(
      "Release configuration missing " + name,
    );
    expect(execFileSync).not.toHaveBeenCalled();
  },
);

test.each(["darwin", "win32"])(
  "%s certificate mode requires platform credentials",
  async (platform) => {
    configure(platform, false);
    await expect(import("./bundle-release")).rejects.toThrow(
      "Release configuration missing " +
        (platform === "darwin" ? "APPLE_CERTIFICATE" : "WINDOWS_CERTIFICATE"),
    );
    expect(execFileSync).not.toHaveBeenCalled();
  },
);
