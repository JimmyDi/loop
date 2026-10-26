import { expect, test } from "vitest";

import type { VoiceStatus } from "../../shared/voice";
import { voiceSetupReady, voiceSetupSignature } from "./setup-readiness";

const installed = (): VoiceStatus => ({
  supported: true,
  installed: true,
  ttsInstalled: true,
  engineAvailable: true,
  localManagement: true,
  phase: "idle",
  version: "1",
  components: ["engine", "asr", "vad", "tts"].map((kind) => ({
    kind: kind as NonNullable<VoiceStatus["components"]>[number]["kind"],
    id: kind,
    name: kind,
    installed: true,
    downloadBytes: 1,
    installedBytes: 1,
    license: "Apache-2.0",
    version: "1",
  })),
});

test("setup completion requires a microphone test for the current profile and device", () => {
  const status = installed();
  const proof = voiceSetupSignature(status, "conversation", "microphone");
  expect(proof).toBeDefined();
  expect(voiceSetupReady(status, "conversation", "microphone", proof)).toBe(true);
  expect(voiceSetupReady(status, "conversation", "microphone", undefined)).toBe(false);
  expect(voiceSetupReady(status, "input", "microphone", proof)).toBe(false);
  expect(voiceSetupReady(status, "conversation", "other", proof)).toBe(false);
});

test.each(["idle", "installing", "updating", "uninstalling", "error"] as const)(
  "only idle resources can satisfy a saved microphone test during phase %s",
  (phase) => {
    const status = installed();
    const proof = voiceSetupSignature(status, "conversation", "");
    status.phase = phase;
    expect(voiceSetupReady(status, "conversation", "", proof)).toBe(phase === "idle");
  },
);

test("missing, unsupported, errored, and incomplete resources always block setup completion", () => {
  const status = installed();
  const proof = voiceSetupSignature(status, "conversation", "");
  const blocked: Array<VoiceStatus | undefined> = [
    undefined,
    { ...status, supported: false },
    { ...status, installed: false },
    { ...status, error: "voice_failure" },
    { ...status, engineAvailable: false },
    { ...status, version: undefined },
    { ...status, version: " " },
    { ...status, components: undefined },
    { ...status, components: [] },
    { ...status, ttsInstalled: false },
    { ...status, ttsInstalled: undefined },
    { ...status, components: status.components?.filter((value) => value.kind !== "vad") },
    {
      ...status,
      components: status.components?.map((value) =>
        value.kind === "asr" ? { ...value, installed: false } : value,
      ),
    },
  ];
  for (const value of blocked) {
    expect(voiceSetupSignature(value, "conversation", "")).toBeUndefined();
    expect(voiceSetupReady(value, "conversation", "", proof)).toBe(false);
  }
});

test("input setup accepts installed recognition without synthesis", () => {
  const status = installed();
  status.ttsInstalled = false;
  status.components = status.components?.map((value) =>
    value.kind === "tts" ? { ...value, installed: false } : value,
  );
  expect(voiceSetupSignature(status, "input", "")).toBeDefined();
  expect(voiceSetupSignature(status, "conversation", "")).toBeUndefined();
});

test("resource identity changes invalidate the test while display metadata and ordering do not", () => {
  const status = installed();
  const proof = voiceSetupSignature(status, "conversation", "");
  const reordered = {
    ...status,
    components: status.components
      ?.map((value) => ({ ...value, name: "Renamed", downloadBytes: 2 }))
      .reverse(),
  };
  expect(voiceSetupSignature(reordered, "conversation", "")).toBe(proof);
  expect(voiceSetupSignature({ ...status, version: "2" }, "conversation", "")).not.toBe(proof);
  for (const field of ["id", "version"] as const) {
    const changed = {
      ...status,
      components: status.components?.map((value) =>
        value.kind === "asr" ? { ...value, [field]: "changed" } : value,
      ),
    };
    expect(voiceSetupSignature(changed, "conversation", "")).not.toBe(proof);
  }
});
