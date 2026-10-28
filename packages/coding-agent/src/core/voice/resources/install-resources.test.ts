import { expect, test, vi, beforeEach } from "vitest";

import { installVoiceResources } from "./install-resources";
import { installVoicePackage } from "./install-package";
import { atomicJson } from "./json-storage";
import { probeVoiceEngine } from "./probe";
import type { VoiceResourceOperationState } from "./resource-types";

vi.mock("./engine-resolution", () => ({
  resolveVoiceEngine: async () => ({
    component: { id: "engine", kind: "engine", files: [] },
    executable: "loop-voice",
  }),
}));
vi.mock("./install-package", () => ({ installVoicePackage: vi.fn() }));
vi.mock("./json-storage", () => ({ readJson: async () => undefined, atomicJson: vi.fn() }));
vi.mock("./probe", () => ({ probeVoiceEngine: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

test("starts all four packages together and activates only after every package finishes", async () => {
  const finishes: Array<() => void> = [];
  vi.mocked(installVoicePackage).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishes.push(resolve);
      }),
  );
  const state: VoiceResourceOperationState = { phase: "installing" };
  const installing = installVoiceResources("voice", state, { tts: true });
  await vi.waitFor(() => expect(finishes).toHaveLength(4));
  finishes.slice(0, 3).forEach((finish) => finish());
  await Promise.resolve();
  expect(probeVoiceEngine).not.toHaveBeenCalled();
  expect(atomicJson).not.toHaveBeenCalled();
  finishes[3]!();
  await installing;
  expect(probeVoiceEngine).toHaveBeenCalledOnce();
  expect(atomicJson).toHaveBeenCalledOnce();
});

test("a failed package does not stop siblings or release the operation before they settle", async () => {
  let finish: (() => void) | undefined;
  vi.mocked(installVoicePackage).mockImplementation(async (_directory, component) => {
    if (component.kind === "asr") throw new Error("voice_resource_integrity_failed");
    if (component.kind === "tts")
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  });
  let settled = false;
  const installing = installVoiceResources("voice", { phase: "installing" }, { tts: true });
  const result = installing.catch((error: Error) => {
    settled = true;
    return error;
  });
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(settled).toBe(false);
  expect(installVoicePackage).toHaveBeenCalledTimes(4);
  finish!();
  expect(await result).toMatchObject({ message: "voice_resource_integrity_failed" });
  expect(probeVoiceEngine).not.toHaveBeenCalled();
  expect(atomicJson).not.toHaveBeenCalled();
});

test("cancellation reaches every package and waits for cleanup before rejecting", async () => {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  vi.mocked(installVoicePackage).mockImplementation(
    (_directory, _component, _published, _state, signal) =>
      new Promise<void>((_resolve, reject) => {
        signal.addEventListener("abort", () => cleanups.push(() => reject(signal.reason)), {
          once: true,
        });
      }),
  );
  let settled = false;
  const installing = installVoiceResources(
    "voice",
    { phase: "installing" },
    { tts: true },
    controller.signal,
  );
  const result = installing.catch(() => {
    settled = true;
  });
  await vi.waitFor(() => expect(installVoicePackage).toHaveBeenCalledTimes(4));
  controller.abort();
  expect(cleanups).toHaveLength(4);
  cleanups.slice(0, 3).forEach((cleanup) => cleanup());
  await Promise.resolve();
  expect(settled).toBe(false);
  cleanups[3]!();
  await result;
  expect(atomicJson).not.toHaveBeenCalled();
});
