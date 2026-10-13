import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";
import { TraceRecorder } from "@loop/telemetry";
import type { TraceEvent } from "@loop/telemetry";

import { traceModelRuntime } from "./model-trace";
import { SessionTrace } from "./session-trace";
import type { ModelRuntime } from "../model-runtime";

const storedEvents = async (directory: string): Promise<TraceEvent[]> => {
  const segments = (await readdir(directory))
    .filter((name) => /^events-\d+\.jsonl$/.test(name))
    .sort();
  const events: TraceEvent[] = [];
  for (const segment of segments) {
    const text = await readFile(join(directory, segment), "utf8");
    events.push(
      ...text
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as TraceEvent),
    );
  }
  return events;
};

const model: Model<"openai-completions"> = {
  api: "openai-completions",
  id: "synthetic",
  name: "Synthetic",
  provider: "synthetic",
  baseUrl: "https://provider.example.test",
  contextWindow: 100000,
  maxTokens: 1000,
  input: ["text"],
  reasoning: false,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

const answer = (): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text: "synthetic answer" }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  stopReason: "stop",
  timestamp: Date.now(),
  usage: {
    input: 2,
    output: 3,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 5,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
});

test("model tap keeps one native consumer, result and request identity; stream records omit growing partials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-model-trace-"));
  const recorder = await TraceRecorder.open(directory, "synthetic-session", { mode: "stream" });
  try {
    const trace = new SessionTrace(recorder);
    trace.start({ content: "synthetic input", skills: [], queued: false }, false);
    const source = createAssistantMessageEventStream();
    const message = answer();
    source.push({ type: "start", partial: message });
    source.push({
      type: "text_delta",
      contentIndex: 0,
      delta: "synthetic answer",
      partial: message,
    });
    source.push({ type: "done", reason: "stop", message });
    const iterator = vi.spyOn(source, Symbol.asyncIterator);
    const context: Context = {
      messages: [{ role: "user", content: "synthetic input", timestamp: 0 }],
    };
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: vi.fn(() => source),
    };
    const tapped = traceModelRuntime(runtime, trace);
    const options = { apiKey: "synthetic key", headers: { auth: "synthetic header" } };
    const stream = await tapped.streamSimple(model, context, options);
    const seen = [];
    for await (const event of stream) seen.push(event);
    expect(await stream.result()).toBe(message);
    expect(iterator).toHaveBeenCalledTimes(1);
    expect(runtime.streamSimple).toHaveBeenCalledWith(model, context, options, undefined);
    expect(seen.map((event) => event.type)).toEqual(["start", "text_delta", "done"]);
    await trace.flush();
    const page = { events: await storedEvents(directory) };
    const deltas = page.events.filter((event) => event.type === "model.stream.received");
    expect(deltas).toHaveLength(2);
    expect(JSON.stringify(deltas)).not.toContain("partial");
    expect(JSON.stringify(page)).not.toContain("synthetic key");
    expect(JSON.stringify(page)).not.toContain(model.baseUrl);
    expect(page.events.filter((event) => event.type === "model.request.completed")).toHaveLength(1);
  } finally {
    await recorder.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("late title completion retains its original run and cancellation closes a pending call once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-model-cancel-"));
  const recorder = await TraceRecorder.open(directory, "synthetic-session");
  try {
    const trace = new SessionTrace(recorder);
    trace.start({ content: "first", skills: [], queued: false }, false);
    const firstRun = trace.runId;
    const source = createAssistantMessageEventStream();
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: () => source,
    };
    const title = await traceModelRuntime(runtime, trace).forPurpose!("title").streamSimple(model, {
      messages: [],
    });
    trace.settle({ outcome: "success" });
    trace.start({ content: "second", skills: [], queued: false }, false);
    source.push({ type: "done", reason: "stop", message: answer() });
    for await (const _event of title) {
      /* native consumption */
    }
    const cancel = new AbortController();
    const pending = Promise.withResolvers<ReturnType<typeof createAssistantMessageEventStream>>();
    const tapped = traceModelRuntime({ ...runtime, streamSimple: () => pending.promise }, trace);
    const dispatched = tapped.streamSimple(model, { messages: [] }, { signal: cancel.signal });
    cancel.abort();
    pending.resolve(createAssistantMessageEventStream());
    await dispatched;
    await trace.flush();
    const ends = (await storedEvents(directory)).filter(
      (event) => event.type === "model.request.completed",
    );
    expect(ends).toHaveLength(2);
    expect(ends[0].runId).toBe(firstRun);
    expect(ends[1].data).toMatchObject({ result: { outcome: "cancelled" } });
    const alreadyCancelled = new AbortController();
    alreadyCancelled.abort();
    await traceModelRuntime(runtime, trace).streamSimple(
      model,
      { messages: [] },
      { signal: alreadyCancelled.signal },
    );
    await trace.flush();
    expect((await storedEvents(directory)).at(-1)?.data).toMatchObject({
      result: { outcome: "cancelled" },
    });
  } finally {
    await recorder.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("disabled and closed recording bypasses model wrapping and operation tracking", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-model-no-trace-"));
  const recorder = await TraceRecorder.open(directory, "synthetic-session");
  try {
    const trace = new SessionTrace(recorder);
    const source = createAssistantMessageEventStream();
    const runtime: ModelRuntime = {
      getModel: () => model,
      getModels: () => [model],
      checkModel: async () => {},
      streamSimple: vi.fn(() => source),
    };
    const tapped = traceModelRuntime(runtime, trace);
    await recorder.close();
    expect(traceModelRuntime(runtime, trace)).toBe(runtime);
    expect(traceModelRuntime(runtime, new SessionTrace())).toBe(runtime);
    expect(tapped.streamSimple(model, { messages: [] })).toBe(source);
    trace.start({ skills: [], queued: false }, false);
    expect(trace.runId).toBeUndefined();
    expect(trace.begin("compaction", { trigger: "manual", historyMessageCount: 0 })).toBe("");
    expect(trace.modelParentId).toBeUndefined();
    expect(recorder.status.lastWrittenSeq).toBe(-1);
  } finally {
    await recorder.close();
    await rm(directory, { recursive: true, force: true });
  }
});
