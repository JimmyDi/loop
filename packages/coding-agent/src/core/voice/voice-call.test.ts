import { expect, test, vi } from "vitest";

import { VoiceRuntime } from "./voice-runtime";
import type { VoiceEvent, VoiceRuntimeResources } from "./voice-types";

const engine = String.raw`
const readline = require("node:readline");
let synthesizing = false;
const send = (id, type, fields = {}) => process.stdout.write(JSON.stringify({v:1,id,type,...fields}) + "\n");
readline.createInterface({input: process.stdin}).on("line", (line) => {
  const command = JSON.parse(line);
  const {id,type} = command;
  if (type === "configure") send(id,"ready");
  if (type === "audio") {
    if (command.samples === "//8=") {process.stdout.write("invalid\n"); return;}
    if (command.samples === "AQE=") return;
    send(id,"speech",{active:true});
    send(id,"transcript",{text:"检查",final:false});
    send(id,"completed");
  }
  if (type === "end") {
    send(id,"transcript",{text:"检查代码",final:true});
    send(id,"speech",{active:false});
    send(id,"completed");
  }
  if (type === "synthesize") {
    if (synthesizing) {send(id,"error",{code:"voice_tts_busy"});return;}
    synthesizing = true;
    setTimeout(() => {
      synthesizing = false;
      send(id,"audio",{samples:"AAA=",sampleRate:24000});
      send(id,"completed");
    },command.text === "slow" ? 30 : 0);
  }
  if (type === "cancel") {synthesizing = false;send(id,"completed");}
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

test("native runtime streams transcripts and PCM, cancels stale speech and releases its lease", async () => {
  const release = vi.fn();
  const runtime = new VoiceRuntime({ resources: () => ({ resources: resources(), release }) });
  const events: VoiceEvent[] = [];
  try {
    const call = await runtime.startCall({ mode: "conversation" });
    await expect(runtime.startCall({ mode: "dictation" })).rejects.toThrow("voice_call_active");
    call.subscribe(() => {
      throw new Error("observer");
    });
    call.subscribe((event) => events.push(event));
    await call.writeAudio(new Uint8Array([0, 0, 1, 0]));
    await call.endInput();
    expect(events.filter((event) => event.type === "transcript")).toEqual([
      { callId: call.id, type: "transcript", text: "检查", final: false },
      { callId: call.id, type: "transcript", text: "检查代码", final: true },
    ]);
    await call.synthesize("result", { requestId: "result" });
    expect(events.find((event) => event.type === "audio")).toEqual({
      callId: call.id,
      type: "audio",
      requestId: "result",
      samples: new Uint8Array(2),
      sampleRate: 24000,
    });
    const cancelled = call
      .synthesize("slow", { requestId: "stale" })
      .catch((error: Error) => error.message);
    call.cancelSpeech();
    expect(await cancelled).toBe("voice_cancelled");
    await call.synthesize("slow", { requestId: "fresh" });
    expect(events.some((event) => event.type === "audio" && event.requestId === "stale")).toBe(
      false,
    );
    const abort = new AbortController();
    const interrupted = call
      .synthesize("slow", { requestId: "reused", signal: abort.signal })
      .catch((error: Error) => error.message);
    abort.abort();
    expect(await interrupted).toBe("voice_cancelled");
    await call.synthesize("slow", { requestId: "reused" });
    expect(
      events.filter((event) => event.type === "audio" && event.requestId === "reused"),
    ).toHaveLength(1);
    await expect(call.writeAudio(new Uint8Array(1))).rejects.toThrow("voice_invalid_audio");
    await call.close();
    expect(events.at(-1)).toEqual({ callId: call.id, type: "state", state: "closed" });
    expect(release).toHaveBeenCalledTimes(1);
    expect(runtime.isActive).toBe(false);
    await expect(call.endInput()).rejects.toThrow("voice_call_closed");
  } finally {
    await runtime.close();
  }
});

test("a malformed active engine frame closes the call and rejects pending audio", async () => {
  const release = vi.fn();
  const runtime = new VoiceRuntime({ resources: () => ({ resources: resources(), release }) });
  const call = await runtime.startCall({ mode: "dictation" });
  const closed = Promise.withResolvers<void>();
  const errors: string[] = [];
  call.subscribe((event) => {
    if (event.type === "error") errors.push(event.code);
    if (event.type === "state" && event.state === "closed") closed.resolve();
  });
  await expect(call.writeAudio(new Uint8Array([255, 255]))).rejects.toThrow(
    "voice_engine_protocol_error",
  );
  await closed.promise;
  expect(errors).toEqual(["voice_engine_protocol_error"]);
  expect(release).toHaveBeenCalledTimes(1);
  expect(runtime.isActive).toBe(false);
  await runtime.close();
});

test("pending microphone input is bounded and closing rejects all acknowledgements", async () => {
  const runtime = new VoiceRuntime({ resources: () => resources() });
  const call = await runtime.startCall({ mode: "dictation" });
  const pending = Array.from({ length: 16 }, () =>
    call.writeAudio(new Uint8Array([1, 1])).catch((error: Error) => error.message),
  );
  await expect(call.writeAudio(new Uint8Array([1, 1]))).rejects.toThrow("voice_audio_overloaded");
  await call.close();
  expect(await Promise.all(pending)).toEqual(Array(16).fill("voice_engine_closed"));
  expect(runtime.isActive).toBe(false);
  expect(() => new VoiceRuntime({ resources: () => resources(), startupTimeoutMs: 0 })).toThrow(
    "voice_invalid_timeout",
  );
});

test("discarding input suppresses pending transcripts and finals then resumes fresh recognition", async () => {
  const runtime = new VoiceRuntime({ resources: () => resources() });
  const call = await runtime.startCall({ mode: "conversation" });
  const events: VoiceEvent[] = [];
  call.subscribe((event) => events.push(event));
  try {
    const pending = call.writeAudio(new Uint8Array([0, 0]));
    const discarded = call.discardInput();
    expect(call.discardInput()).toBe(discarded);
    await expect(call.writeAudio(new Uint8Array([0, 0]))).rejects.toThrow("voice_input_resetting");
    await Promise.all([pending, discarded]);
    expect(events).toEqual([]);
    await call.writeAudio(new Uint8Array([0, 0]));
    await call.endInput();
    expect(events.filter((event) => event.type === "transcript")).toHaveLength(2);
    expect(events.filter((event) => event.type === "speech")).toHaveLength(2);
  } finally {
    await runtime.close();
  }
});

test("synthesis queues one native invocation at a time and interruption cancels waiting narration", async () => {
  const runtime = new VoiceRuntime({ resources: () => resources() });
  const call = await runtime.startCall({ mode: "conversation" });
  const audio: string[] = [];
  call.subscribe((event) => {
    if (event.type === "audio") audio.push(event.requestId);
  });
  try {
    await Promise.all([
      call.synthesize("slow", { requestId: "first" }),
      call.synthesize("next", { requestId: "second" }),
      call.synthesize("last", { requestId: "third" }),
    ]);
    expect(audio).toEqual(["first", "second", "third"]);
    const cancelled = ["active", "waiting"].map((requestId) =>
      call.synthesize("slow", { requestId }).catch((error: Error) => error.message),
    );
    call.cancelSpeech();
    expect(await Promise.all(cancelled)).toEqual(["voice_cancelled", "voice_cancelled"]);
    await call.synthesize("replacement", { requestId: "replacement" });
    expect(audio).toEqual(["first", "second", "third", "replacement"]);
  } finally {
    await runtime.close();
  }
});
