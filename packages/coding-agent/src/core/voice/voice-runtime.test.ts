import { expect, test, vi } from "vitest";

import { VoiceRuntime } from "./voice-runtime";
import type { VoiceRuntimeResources } from "./voice-types";

const engine = String.raw`
const readline = require("node:readline");
const send = (id, type) => process.stdout.write(JSON.stringify({v:1,id,type}) + "\n");
readline.createInterface({input: process.stdin}).on("line", (line) => {
  const {id,type} = JSON.parse(line);
  if (type === "configure") send(id,"ready");
  if (type === "close") {send(id,"completed");process.exit(0);}
});`;

const resources = (script = engine): VoiceRuntimeResources => ({
  executablePath: process.execPath,
  args: ["-e", script],
  configuration: {
    asr: { encoder: "encoder", decoder: "decoder", joiner: "joiner", tokens: "tokens" },
    vad: { model: "vad" },
    tts: { model: "tts", voices: "voices", tokens: "tokens" },
  },
});

test("runtime rejects concurrent calls and releases its resource lease when the call closes", async () => {
  const release = vi.fn();
  const runtime = new VoiceRuntime({ resources: () => ({ resources: resources(), release }) });
  try {
    const call = await runtime.startCall({ mode: "conversation" });
    expect(runtime.isActive).toBe(true);
    await expect(runtime.startCall({ mode: "dictation" })).rejects.toThrow("voice_call_active");
    await call.close();
    expect(release).toHaveBeenCalledTimes(1);
    expect(runtime.isActive).toBe(false);
  } finally {
    await runtime.close();
  }
});

test("runtime validates configured operation and startup timeouts", () => {
  expect(() => new VoiceRuntime({ resources: () => resources(), startupTimeoutMs: 0 })).toThrow(
    "voice_invalid_timeout",
  );
  expect(
    () =>
      new VoiceRuntime({
        resources: () => resources(),
        operationTimeoutMs: Number.POSITIVE_INFINITY,
      }),
  ).toThrow("voice_invalid_timeout");
});

test("dictation needs no TTS and close during resource acquisition releases once", async () => {
  const value = resources();
  delete value.configuration.tts;
  const runtime = new VoiceRuntime({ resources: () => value });
  try {
    const call = await runtime.startCall({ mode: "dictation" });
    await expect(call.synthesize("text")).rejects.toThrow("voice_tts_unavailable");
  } finally {
    await runtime.close();
  }
  const ready = Promise.withResolvers<{ resources: VoiceRuntimeResources; release: () => void }>();
  const release = vi.fn();
  const acquiring = new VoiceRuntime({ resources: () => ready.promise });
  const start = acquiring.startCall({ mode: "dictation" });
  const closed = acquiring.close();
  ready.resolve({ resources: value, release });
  await expect(start).rejects.toThrow("voice_call_closed");
  await closed;
  expect(release).toHaveBeenCalledTimes(1);
  expect(acquiring.isActive).toBe(false);
});

test("engine protocol failure and startup timeout fail closed and release resources", async () => {
  for (const script of [
    String.raw`process.stdin.resume();process.stdout.write("invalid\n");`,
    "process.stdin.resume();",
  ]) {
    const release = vi.fn();
    const runtime = new VoiceRuntime({
      resources: () => ({ resources: resources(script), release }),
      startupTimeoutMs: 300,
    });
    await expect(runtime.startCall({ mode: "dictation" })).rejects.toThrow(
      /voice_engine_(protocol_error|timeout)/,
    );
    await runtime.close();
    expect(release).toHaveBeenCalledTimes(1);
    expect(runtime.isActive).toBe(false);
  }
});
