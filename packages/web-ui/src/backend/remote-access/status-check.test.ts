import { expect, test, vi } from "vitest";

import type { RemoteAccessStatus } from "../../shared/remote-access";
import { createCliRuntime } from "./cli-runtime";
import { checkInstallation } from "./status-check";

test("missing executable fails only a completed install and restored file clears the failure", async () => {
  const runtime = createCliRuntime("synthetic-data-directory");
  runtime.installed = vi.fn(async () => false);
  const signal = new AbortController().signal;
  const initial: RemoteAccessStatus = {
    supported: true,
    installed: true,
    signedIn: true,
    phase: "off",
  };
  const missing = await checkInstallation(runtime, initial, signal);
  expect(missing).toMatchObject({ installed: false, signedIn: false, failedSteps: ["install"] });
  expect(initial.installed).toBe(true);
  runtime.installed = vi.fn(async () => true);
  const recovered = await checkInstallation(runtime, missing, signal);
  expect(recovered).toMatchObject({ installed: true, signedIn: false, failedSteps: undefined });
  const abort = new AbortController();
  abort.abort();
  await expect(checkInstallation(runtime, initial, abort.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
