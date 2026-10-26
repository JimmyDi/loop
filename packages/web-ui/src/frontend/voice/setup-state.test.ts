import { afterEach, beforeEach, expect, test, vi } from "vitest";

let stored: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});

afterEach(() => vi.unstubAllGlobals());

test("setup defaults to conversation and shares the existing microphone preference", async () => {
  stored.set("loop.voice.microphone", "microphone-a");
  const { useVoiceSetupState } = await import("./setup-state");
  const { voiceDevice } = await import("./device");
  expect(useVoiceSetupState.getState().profile).toBe("conversation");
  expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
  expect(voiceDevice()).toBe("microphone-a");
  expect(stored.size).toBe(1);
});

test("completed test and profile survive reload without saving transcripts or audio", async () => {
  const { useVoiceSetupState } = await import("./setup-state");
  useVoiceSetupState.getState().setProfile("input");
  useVoiceSetupState.getState().setDevice("microphone-b");
  useVoiceSetupState.getState().verify("resource-signature");
  expect(JSON.parse(stored.get("loop.web.voice.setup") ?? "null")).toEqual({
    profile: "input",
    verifiedSignature: "resource-signature",
  });
  vi.resetModules();
  const restored = (await import("./setup-state")).useVoiceSetupState.getState();
  expect(restored.profile).toBe("input");
  expect(restored.deviceId).toBe("microphone-b");
  expect(restored.verifiedSignature).toBe("resource-signature");
});

test("actual profile or microphone changes clear verification and retain shared selection", async () => {
  const { useVoiceSetupState } = await import("./setup-state");
  const { voiceDevice, saveVoiceDevice } = await import("./device");
  useVoiceSetupState.getState().verify("first");
  useVoiceSetupState.getState().setProfile("conversation");
  saveVoiceDevice("");
  expect(useVoiceSetupState.getState().verifiedSignature).toBe("first");
  useVoiceSetupState.getState().setProfile("input");
  expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
  useVoiceSetupState.getState().verify("second");
  saveVoiceDevice("microphone-c");
  expect(voiceDevice()).toBe("microphone-c");
  expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
  expect(stored.get("loop.voice.microphone")).toBe("microphone-c");
  useVoiceSetupState.getState().verify("third");
  useVoiceSetupState.getState().clearVerification();
  expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
  expect(JSON.parse(stored.get("loop.web.voice.setup") ?? "null")).toEqual({
    profile: "input",
  });
});

test.each([
  null,
  [],
  { profile: "unsupported" },
  { profile: "input", verifiedSignature: 1 },
  { profile: "input", verifiedSignature: "" },
  { profile: "input", verifiedSignature: "x".repeat(16385) },
  { profile: "input", verifiedSignature: "proof", transcript: "example" },
])("corrupt setup preference %j fails closed", async (value) => {
  stored.set("loop.web.voice.setup", JSON.stringify(value));
  const { useVoiceSetupState } = await import("./setup-state");
  expect(useVoiceSetupState.getState().profile).toBe("conversation");
  expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
});

test("unavailable storage preserves current in-memory setup without interrupting voice", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("Unavailable");
    },
    setItem: () => {
      throw new Error("Full");
    },
  });
  const { useVoiceSetupState } = await import("./setup-state");
  expect(useVoiceSetupState.getState().profile).toBe("conversation");
  useVoiceSetupState.getState().setProfile("input");
  useVoiceSetupState.getState().setDevice("microphone");
  useVoiceSetupState.getState().verify("proof");
  expect(useVoiceSetupState.getState().verifiedSignature).toBe("proof");
  expect(useVoiceSetupState.getState().deviceId).toBe("microphone");
});
