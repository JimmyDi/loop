import { mkdtemp, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, vi } from "vitest";

import { TraceRecorder } from "./recorder";
import { readTrace } from "./reader";

test("ordered immutable snapshots, payloads, rotation and reopening preserve session sequences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session", { segmentBytes: 400 });
  try {
    const data = { text: "first", apiKey: "synthetic credential" };
    trace.record({ type: "run.started", data, operationId: "run" });
    data.text = "changed";
    trace.record({
      type: "model.request.started",
      data: { text: "synthetic payload ".repeat(2000) },
    });
    trace.record({ type: "run.completed", operationId: "run" });
    await trace.close();
    const page = await readTrace(directory, { limit: 2 });
    expect(page.hasMore).toBe(true);
    expect(page.events.map((event) => event.seq)).toEqual([0, 1]);
    expect(page.events[0].data).toEqual({ text: "first", apiKey: "[REDACTED]" });
    expect(page.events[1].payloadRef).toMatch(/^payloads\//);
    expect(page.events[1].data).toEqual({ text: "synthetic payload ".repeat(2000) });
    expect((await stat(join(directory, "manifest.json"))).mode & 0o777).toBe(0o600);
    expect(
      (await readdir(directory)).filter((name) => name.startsWith("events-")).length,
    ).toBeGreaterThan(1);
    const reopened = await TraceRecorder.open(directory, "synthetic-session");
    reopened.record({ type: "session.attached" });
    await reopened.close();
    expect(
      (await readTrace(directory, { afterSeq: page.nextSeq })).events.map((event) => event.seq),
    ).toEqual([2, 3]);
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("bounded queues and payload limits are explicit without throwing to callers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-limit-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session", { maxQueueBytes: 1000 });
  try {
    for (let i = 0; i < 20; i++) trace.record({ type: "event", data: { value: "x".repeat(200) } });
    expect(trace.status.droppedEvents).toBeGreaterThan(0);
    await trace.flush();
    expect(trace.status.queuedBytes).toBe(0);
    expect((await readTrace(directory)).manifest?.complete).toBe(false);
    await trace.close();
    const bounded = await TraceRecorder.open(directory, "synthetic-session", {
      maxPayloadBytes: 17000,
    });
    bounded.record({ type: "large", data: { text: "x".repeat(20000) } });
    await bounded.close();
    expect((await readTrace(directory)).events.at(-1)?.data).toMatchObject({
      omitted: true,
      reason: "payload_limit",
    });
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("writer ownership and initialization failures disable only recording", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-owner-"));
  const first = await TraceRecorder.open(directory, "synthetic-session");
  try {
    const second = await TraceRecorder.open(directory, "synthetic-session");
    expect(second.status.enabled).toBe(false);
    expect(() => second.record({ type: "ignored" })).not.toThrow();
    await second.close();
    first.record({ type: "still owned" });
    await first.close();
    expect((await readTrace(directory)).events).toHaveLength(1);
    await writeFile(join(directory, "not-directory"), "fixture");
    const disabled = await TraceRecorder.open(
      join(directory, "not-directory"),
      "synthetic-session",
    );
    expect(disabled.status.complete).toBe(false);
    await disabled.close();
  } finally {
    await first.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("disk failures drain the queue and report incomplete recording", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-failure-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  try {
    await rm(join(directory, "payloads"), { recursive: true });
    trace.record({ type: "large", data: { text: "x".repeat(20000) } });
    await expect(trace.flush()).resolves.toBeUndefined();
    expect(trace.status).toMatchObject({ enabled: false, complete: false, queuedBytes: 0 });
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    expect(manifest.complete).toBe(false);
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("metadata storage excludes nested bodies and reopening never reuses dropped sequences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-metadata-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session", {
    mode: "metadata",
    maxQueueBytes: 1000,
  });
  try {
    trace.record({
      type: "tool.completed",
      data: {
        toolCallId: "synthetic-call",
        isError: false,
        args: { command: "synthetic command" },
        result: { content: [{ text: "synthetic output" }], usage: { tokens: 2 } },
      },
    });
    trace.record({ type: "dropped", data: { value: "x".repeat(2000) } });
    await trace.close();
    const first = await readTrace(directory);
    expect(first.events[0].data).toEqual({
      toolCallId: "synthetic-call",
      isError: false,
      result: { usage: { tokens: 2 } },
    });
    expect(first.manifest).toMatchObject({ nextSeq: 2, droppedEvents: 1 });
    const reopened = await TraceRecorder.open(directory, "synthetic-session");
    reopened.record({ type: "resumed" });
    await reopened.close();
    const page = await readTrace(directory);
    expect(page.events.map((event) => event.seq)).toEqual([0, 2]);
    expect(page.warnings).toContain("Event gap before sequence 2");
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent sessions write independent ordered files before closing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-concurrent-"));
  const first = await TraceRecorder.open(join(directory, "first"), "synthetic-first");
  const second = await TraceRecorder.open(join(directory, "second"), "synthetic-second");
  try {
    for (let index = 0; index < 25; index++) {
      first.record({ type: "first.event", data: { index } });
      second.record({ type: "second.event", data: { index } });
    }
    await Promise.all([first.flush(), second.flush()]);
    for (const [name, sessionId] of [
      ["first", "synthetic-first"],
      ["second", "synthetic-second"],
    ]) {
      const file = await readFile(join(directory, name, "events-000001.jsonl"), "utf8");
      const events = file
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(events.map((event) => event.seq)).toEqual(
        Array.from({ length: 25 }, (_, index) => index),
      );
      expect(new Set(events.map((event) => event.sessionId))).toEqual(new Set([sessionId]));
    }
  } finally {
    await Promise.all([first.close(), second.close()]);
    await rm(directory, { recursive: true, force: true });
  }
});

test("a burst uses one event write and close drains subsequently accepted events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-burst-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  const probe = await open(join(directory, "probe"), "w");
  const write = vi.spyOn(Object.getPrototypeOf(probe), "writeFile");
  try {
    for (let index = 0; index < 100; index++) trace.record({ type: "event", data: { index } });
    await trace.flush();
    const before = await readTrace(directory);
    expect(before.events).toHaveLength(100);
    expect(trace.status.lastWrittenSeq).toBe(99);
    // One event-segment write and one manifest write, instead of 100 event writes.
    expect(write).toHaveBeenCalledTimes(2);
    trace.record({ type: "later" });
    await trace.close();
    expect((await readTrace(directory)).events).toHaveLength(101);
    expect(trace.status.queuedBytes).toBe(0);
  } finally {
    write.mockRestore();
    await trace.close();
    await probe.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("recording starts without flush and closed recorders never inspect payloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-background-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  try {
    trace.record({ type: "background" });
    await vi.waitFor(() => expect(trace.status.lastWrittenSeq).toBe(0));
    await trace.close();
    const data = vi.fn(() => {
      throw new Error("Closed recorder must not inspect data");
    });
    trace.record({
      type: "ignored",
      get data() {
        return data();
      },
    });
    expect(data).not.toHaveBeenCalled();
    expect((await readTrace(directory)).events).toHaveLength(1);
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("flush waits for its captured batch without waiting for later writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-flush-boundary-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  const probe = await open(join(directory, "probe"), "w");
  const prototype = Object.getPrototypeOf(probe) as typeof probe;
  const original = prototype.writeFile;
  const firstStarted = Promise.withResolvers<void>();
  const firstGate = Promise.withResolvers<void>();
  const laterStarted = Promise.withResolvers<void>();
  const laterGate = Promise.withResolvers<void>();
  const write = vi.spyOn(prototype, "writeFile").mockImplementation(async function (
    this: typeof probe,
    ...args: Parameters<typeof probe.writeFile>
  ) {
    if (typeof args[0] === "string" && args[0].includes('"type":"first"')) {
      firstStarted.resolve();
      await firstGate.promise;
    }
    if (typeof args[0] === "string" && args[0].includes('"type":"later"')) {
      laterStarted.resolve();
      await laterGate.promise;
    }
    return original.apply(this, args);
  });
  try {
    trace.record({ type: "first" });
    const flushing = trace.flush();
    await firstStarted.promise;
    trace.record({ type: "later" });
    firstGate.resolve();
    await flushing;
    await laterStarted.promise;
    expect(trace.status.lastWrittenSeq).toBe(0);
    expect(trace.status.queuedBytes).toBeGreaterThan(0);
    expect((await readTrace(directory)).events.map((event) => event.type)).toEqual(["first"]);
    laterGate.resolve();
    await trace.close();
    expect(trace.status.lastWrittenSeq).toBe(1);
  } finally {
    firstGate.resolve();
    laterGate.resolve();
    await trace.close();
    write.mockRestore();
    await probe.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a failing payload preserves preceding events and counts the unwritten batch tail", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-trace-batch-failure-"));
  const trace = await TraceRecorder.open(directory, "synthetic-session");
  try {
    await rm(join(directory, "payloads"), { recursive: true });
    trace.record({ type: "before" });
    trace.record({ type: "failure", data: { text: "x".repeat(20000) } });
    trace.record({ type: "after" });
    await trace.flush();
    expect(trace.status).toMatchObject({
      enabled: false,
      complete: false,
      lastWrittenSeq: 0,
      droppedEvents: 2,
      queuedBytes: 0,
    });
    expect((await readTrace(directory)).events.map((event) => event.type)).toEqual(["before"]);
  } finally {
    await trace.close();
    await rm(directory, { recursive: true, force: true });
  }
});
