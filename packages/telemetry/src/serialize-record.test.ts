import { expect, test } from "vitest";

import { serializeTraceRecord } from "./serialize-record";
import type { TraceEvent } from "./types";

test("inline JSON and detached payloads preserve escaped content and byte accounting", () => {
  const event: TraceEvent = {
    schemaVersion: 1,
    eventId: "synthetic-event",
    sessionId: "synthetic-session",
    seq: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "synthetic.event",
    data: { text: '雪\n"quoted"\\end', values: [null, true, 1] },
  };
  const inline = serializeTraceRecord(event, 8 * 1024 * 1024);
  expect(JSON.parse(inline.record.line)).toEqual(event);
  expect(inline.record.lineBytes).toBe(Buffer.byteLength(inline.record.line));
  const detached = serializeTraceRecord({ ...event, data: { text: "雪".repeat(6000) } }, 20000);
  expect(detached.omitted).toBe(false);
  expect(JSON.parse(detached.record.line)).toMatchObject({
    payloadRef: "payloads/synthetic-event.json",
  });
  expect(JSON.parse(detached.record.line)).not.toHaveProperty("data");
  expect(JSON.parse(detached.record.payload!.content)).toEqual({ text: "雪".repeat(6000) });
  expect(detached.record.payload!.bytes).toBe(Buffer.byteLength(detached.record.payload!.content));
  const omitted = serializeTraceRecord({ ...event, data: { text: "雪".repeat(6000) } }, 17000);
  expect(omitted.omitted).toBe(true);
  expect(JSON.parse(omitted.record.line).data).toMatchObject({
    omitted: true,
    reason: "payload_limit",
  });
  expect(omitted.record.payload).toBeUndefined();
});
