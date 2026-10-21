import { afterEach, expect, test, vi } from "vitest";

import { CliInstaller } from "./cli-installer";
import { runCli } from "./cli-process";
import { createCliRuntime } from "./cli-runtime";

vi.mock("./cli-process", () => ({ runCli: vi.fn(async () => "") }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runCli).mockReset();
});

test("only explicit login and logout invoke account commands", async () => {
  const runtime = createCliRuntime("synthetic-data-directory");
  const signal = new AbortController().signal;
  expect(runCli).not.toHaveBeenCalled();
  await runtime.login(signal);
  expect(runCli).toHaveBeenCalledWith(
    expect.any(String),
    ["user", "login", "--entra", "--use-browser-auth", "--json"],
    expect.any(AbortSignal),
    0,
  );
  await runtime.logout();
  expect(runCli).toHaveBeenLastCalledWith(
    expect.any(String),
    ["user", "logout", "--json"],
    expect.any(AbortSignal),
  );
});

test("sanitizes provider errors; cancellation stays cancellation", async () => {
  const runtime = createCliRuntime("synthetic-data-directory");
  vi.mocked(runCli).mockRejectedValueOnce(new Error("synthetic-private-error"));
  await expect(runtime.login(new AbortController().signal)).rejects.toMatchObject({
    code: "sign_in_failed",
  });
  const abort = new AbortController();
  abort.abort();
  vi.mocked(runCli).mockRejectedValueOnce(new Error("synthetic-private-error"));
  await expect(runtime.login(abort.signal)).rejects.toMatchObject({ name: "AbortError" });
});

test("installation checks and progress stay within the installer", async () => {
  vi.spyOn(CliInstaller.prototype, "installed").mockResolvedValue(true);
  const install = vi.spyOn(CliInstaller.prototype, "install").mockResolvedValue();
  const pause = vi.spyOn(CliInstaller.prototype, "pause").mockReturnValue(true);
  const uninstall = vi.spyOn(CliInstaller.prototype, "uninstall").mockResolvedValue();
  const runtime = createCliRuntime("synthetic-data-directory");
  const signal = new AbortController().signal;
  expect(await runtime.installed(signal)).toBe(true);
  expect(runCli).not.toHaveBeenCalled();
  const progress = vi.fn();
  await runtime.install(signal, progress);
  expect(install).toHaveBeenCalledWith(signal, progress);
  expect(runtime.pauseDownload(true)).toBe(true);
  expect(runtime.pauseDownload(false)).toBe(true);
  expect(pause.mock.calls).toEqual([[true], [false]]);
  await runtime.uninstall();
  expect(uninstall).toHaveBeenCalledOnce();
  expect(runCli).not.toHaveBeenCalled();
});
