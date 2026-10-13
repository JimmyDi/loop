import { expect, test } from "vitest";

import {
  createTypedTraceBegin,
  createTypedTraceRecord,
  defineTraceEvent,
  defineTraceSchema,
} from "./schema";
import type { TraceInput } from "./types";

const schema = defineTraceSchema({
  version: 1,
  events: {
    "request.started": defineTraceEvent<{ model: string; limit?: number }>("Request started"),
    "request.completed": defineTraceEvent<{ outcome: "success" | "error"; count: number }>(
      "Request settled",
    ),
    "request.detached": defineTraceEvent<undefined>("Request detached"),
  },
});

test("typed schema binds a recorder without changing payloads or explicit relationships", () => {
  const inputs: Array<{ input: TraceInput; runId?: string | null }> = [];
  const record = createTypedTraceRecord(schema, (input, runId) => inputs.push({ input, runId }));
  const payload = { model: "synthetic" };
  record("request.started", payload, "operation", "parent", "run");
  record("request.completed", { outcome: "success", count: 1 }, "operation", "parent", null);
  record("request.detached", undefined);
  expect(inputs[0]).toEqual({
    input: {
      type: "request.started",
      data: payload,
      operationId: "operation",
      parentOperationId: "parent",
    },
    runId: "run",
  });
  expect(inputs[0].input.data).toBe(payload);
  expect(inputs[1].runId).toBeNull();
  expect(inputs[2].input.data).toBeUndefined();
  expect(JSON.parse(JSON.stringify(schema)).events["request.started"]).toEqual({
    description: "Request started",
  });
  const begin = createTypedTraceBegin(schema, (operation, data, parentOperationId) => {
    expect({ operation, data, parentOperationId }).toEqual({
      operation: "request",
      data: payload,
      parentOperationId: "parent",
    });
    return "operation";
  });
  expect(begin("request", payload, "parent")).toBe("operation");
});

// Compiled by the repository typecheck; deliberately never executed.
const checkTypeErrors = () => {
  const record = createTypedTraceRecord(schema, () => {});
  const begin = createTypedTraceBegin(schema, () => "operation");
  record("request.started", { model: "synthetic" });
  // @ts-expect-error Unknown event name.
  record("request.start", { model: "synthetic" });
  // @ts-expect-error Required start attribute missing.
  record("request.started", {});
  // @ts-expect-error Wrong attribute type.
  record("request.started", { model: 1 });
  // @ts-expect-error Payload belongs to another event.
  record("request.completed", { model: "synthetic" });
  // @ts-expect-error Enum value outside the schema.
  record("request.completed", { outcome: "cancelled", count: 1 });
  const extra = { model: "synthetic", secret: "synthetic" };
  // @ts-expect-error Extra attributes are rejected even through variables.
  record("request.started", extra);
  // @ts-expect-error Data-free event accepts only undefined.
  record("request.detached", {});
  // @ts-expect-error Unknown operation name.
  begin("other", { model: "synthetic" });
  // @ts-expect-error Started operation uses its own payload.
  begin("request", { count: 1 });
};

void checkTypeErrors;
