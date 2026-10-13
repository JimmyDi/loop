import { expect, test } from "vitest";
import { createTypedTraceBegin, createTypedTraceRecord } from "@loop/telemetry";

import { SESSION_TRACE_SCHEMA } from "./trace-schema";
import { sessionTraceEventNames } from "./trace-event-names";
import { SessionTrace } from "./session-trace";
import type { PermissionObservation } from "../permissions/policy";
import type { SessionWriteEvent } from "../session-manager";

test("business mapping uses schema-owned names and serializable diagnostic descriptions", () => {
  const events = Object.keys(SESSION_TRACE_SCHEMA.events);
  for (const name of Object.values(sessionTraceEventNames))
    if (name) expect(events).toContain(name);
  for (const [name, entry] of Object.entries(SESSION_TRACE_SCHEMA.events)) {
    expect(name).toMatch(/^[a-z]+(?:\.[a-z]+)+$/);
    expect(entry.description.length).toBeGreaterThan(0);
  }
  expect(JSON.parse(JSON.stringify(SESSION_TRACE_SCHEMA)).version).toBe(1);
});

const checkSessionTypes = () => {
  const record = createTypedTraceRecord(SESSION_TRACE_SCHEMA, () => {});
  const begin = createTypedTraceBegin(SESSION_TRACE_SCHEMA, () => "operation");
  record("run.completed", { outcome: "success" });
  // @ts-expect-error Run completion requires an outcome.
  record("run.completed", { error: "synthetic" });
  // @ts-expect-error Native stream event cannot contain a growing partial response.
  record("model.stream.received", {
    type: "text_delta",
    contentIndex: 0,
    delta: "synthetic",
    partial: {},
  });
  // @ts-expect-error Request completion cannot accept queued input data.
  record("model.request.completed", { id: "synthetic", skills: [] });
  // @ts-expect-error Model request start requires model configuration and options.
  begin("model.request", { purpose: "main" });
  // @ts-expect-error Permission preset is a closed business contract.
  begin("permission.change", { preset: "unknown" });
  const trace = new SessionTrace();
  const forward = (event: PermissionObservation | SessionWriteEvent) => trace.observation(event);
  forward({
    type: "session.save.started",
    operationId: "synthetic",
    messageCount: 0,
    persisted: false,
  });
  // @ts-expect-error Unknown observation type.
  trace.observation({ type: "permission.policy.unknown", preset: "read-only" });
  // @ts-expect-error Policy resolution requires its own payload fields.
  trace.observation({ type: "permission.policy.resolved", preset: "read-only" });
  trace.observation({
    type: "permission.write.checked",
    preset: "read-only",
    // @ts-expect-error A write check requires targetPath, not policy resolution fields.
    writableRootCount: 0,
  });
};

void checkSessionTypes;
