import { beforeEach, expect, test, vi } from "vitest";

import { componentPresent } from "./component-integrity";
import { installComponent } from "./install";
import { installVoicePackage } from "./install-package";
import type { VoiceComponent, VoiceResourceOperationState } from "./resource-types";

vi.mock("./component-integrity", () => ({ componentPresent: vi.fn(async () => false) }));
vi.mock("./install", () => ({ installComponent: vi.fn() }));

const component: VoiceComponent = {
  id: "asr",
  name: "Recognition",
  kind: "asr",
  version: "1",
  license: "MIT",
  files: [{ path: "model", url: "https://example.com/model", bytes: 100, sha256: "0".repeat(64) }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(componentPresent).mockResolvedValue(false);
});

test("aggregates concurrent byte progress and marks completion after installation finishes", async () => {
  const state: VoiceResourceOperationState = {
    phase: "installing",
    packages: { engine: { phase: "installing", received: 10, total: 20 } },
  };
  vi.mocked(installComponent).mockImplementation(async (_root, _component, _signal, progress) => {
    progress(50, 100);
    expect(state.download).toEqual({ received: 60, total: 120 });
    expect(state.packages?.asr?.phase).toBe("installing");
  });
  await installVoicePackage("voice", component, component, state, new AbortController().signal);
  expect(state.packages?.asr).toEqual({ phase: "completed", received: 100, total: 100 });
  expect(state.download).toEqual({ received: 110, total: 120 });
});

test("retry skips an already verified package", async () => {
  vi.mocked(componentPresent).mockResolvedValue(true);
  const state: VoiceResourceOperationState = { phase: "installing", packages: {} };
  await installVoicePackage("voice", component, component, state, new AbortController().signal);
  expect(installComponent).not.toHaveBeenCalled();
  expect(state.packages?.asr?.phase).toBe("completed");
});

test("failure and cancellation have separate per-package states", async () => {
  const state: VoiceResourceOperationState = { phase: "installing", packages: {} };
  vi.mocked(installComponent).mockRejectedValue(new Error("voice_resource_integrity_failed"));
  await expect(
    installVoicePackage("voice", component, component, state, new AbortController().signal),
  ).rejects.toThrow("voice_resource_integrity_failed");
  expect(state.packages?.asr).toMatchObject({
    phase: "error",
    error: "voice_resource_integrity_failed",
  });
  await expect(
    installVoicePackage("voice", component, component, state, AbortSignal.abort()),
  ).rejects.toThrow();
  expect(state.packages?.asr?.phase).toBe("cancelled");
});

test("resume does not mark a completed package loading during integrity verification", async () => {
  let finish: ((installed: boolean) => void) | undefined;
  vi.mocked(componentPresent).mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const state: VoiceResourceOperationState = { phase: "installing", packages: {} };
  const installing = installVoicePackage(
    "voice",
    component,
    component,
    state,
    new AbortController().signal,
  );
  expect(state.packages?.asr).toBeUndefined();
  finish!(true);
  await installing;
  expect(state.packages?.asr?.phase).toBe("completed");
  expect(installComponent).not.toHaveBeenCalled();
});

test("resume retains the previous byte count before new download data arrives", async () => {
  const state: VoiceResourceOperationState = {
    phase: "installing",
    packages: { asr: { phase: "cancelled", received: 45, total: 100 } },
  };
  vi.mocked(installComponent).mockImplementation(async () => {
    expect(state.packages?.asr).toMatchObject({ phase: "installing", received: 45, total: 100 });
  });
  await installVoicePackage("voice", component, component, state, new AbortController().signal);
});
