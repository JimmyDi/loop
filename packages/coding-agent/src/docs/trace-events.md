# Trace event names

## Purpose and contract

This catalog defines the events written by coding-agent's local trace adapter. Names are Loop's own protocol, not OpenTelemetry semantic conventions or an OTLP export format. W3C Trace Context does not define these business event names. No tracing exporter or remote collector is configured.

Log names use lowercase words separated by dots: an entity, an optional operation and an observed phase, such as model.request.started. Names contain no dynamic IDs, tool names, model names or user content; those belong in fields. A completed event means the observed lifetime ended, including errors and cancellation. Read its outcome, stopReason, isError or error fields to determine the result; do not infer success from the name alone.

The [event schema](../core/telemetry/trace-schema.ts) and [business mapping](../core/telemetry/trace-event-names.ts) belong to coding-agent. The schema is the single source of event names and producer payload types; its descriptions are serializable metadata. Typed record/begin helpers infer one overload per event/operation, requiring the corresponding fields and rejecting incorrect types, enum values and extra top-level fields, including variable arguments. Union-valued event names must be narrowed before recording to preserve the name/data relationship.

The contracts describe producer data before capture-mode filtering, credential redaction and payload omission. They reuse business/model types and retain structured content in content mode. TypeScript payload types are erased at runtime: serialized schema metadata contains names, version and descriptions, not JSON Schema validators. The independent telemetry package owns generic schema tools and storage, not business vocabulary. Its storage API remains open. [Schema tests](../core/telemetry/trace-schema.test.ts) include negative type-check cases.

Agent and Session subscribers retain their existing event names. Content records may retain the original event type inside data; native stream types such as text_delta remain inside model.stream.received data.

Save and permission observations already contain a schema event name in their type discriminator. The typed observation entry forwards those complete objects once, preserving the discriminator/data relationship without branching only to narrow a name. Other record calls with independently supplied names still require name narrowing.

## Operation lifetimes

Started/completed pairs share operationId. parentOperationId links narrower operations; missing completed events remain incomplete lifetimes. The adapter records observed boundaries without synthesizing success after crashes.

| Event pair | Captured lifetime |
| --- | --- |
| run.started / run.completed | Accepted prompt or continuation through finalization, including queued inputs |
| input.prepare.started / input.prepare.completed | Input and Skill preparation |
| model.change.started / model.change.completed | Requested model/effort change and persistence |
| model.request.started / model.request.completed | One logical runtime call; purpose distinguishes main, title and compaction |
| tool.started / tool.completed | Sequential tool execution |
| tool.nested.started / tool.nested.completed | A host-observed nested tool call; parent identifies the enclosing tool |
| approval.started / approval.completed | Approval wait and resolution |
| permission.change.started / permission.change.completed | Requested permission preset change and persistence |
| compaction.started / compaction.completed | Manual or automatic compaction |
| session.save.started / session.save.completed | Session history/metadata write attempt |

## Point events

| Event | Meaning |
| --- | --- |
| session.attached | Core attaches recording to a Session |
| session.detached | Core releases the Session before closing recording |
| session.title.updated | Title state or generation error is published; no current run is assigned |
| run.cancel.requested | Cancellation is requested during busy execution; does not confirm settlement |
| agent.settled | Core publishes settled Agent state |
| input.consumed | A queued input is taken for execution |
| message.started | A non-assistant message starts |
| message.completed | A final history message is observed |
| queue.changed | Queue state changes |
| prompt.timing.updated | Per-input timing changes |
| context.budget.updated | Context budget observation |
| skill.loaded | Loaded Skill revisions are published |
| model.input.projected | Actual model input origins are projected |
| model.stream.received | A native stream event is consumed in stream mode, without the growing partial message |
| permission.changed | A persisted permission preset is published |
| permission.policy.resolved | Effective permission policy is resolved |
| permission.write.checked | A file-write target is checked, with denial information when available |
| trace.capture.failed | Event adaptation failed; diagnostic metadata records the failure |

Assistant message_start and all message_update events are omitted here. The model boundary records final responses and optionally native stream events, avoiding repeated growing draft snapshots.

## Business event adaptation

| Original business event | Stored trace event |
| --- | --- |
| message_start / message_end | message.started / message.completed |
| tool_execution_start / tool_execution_end | tool.started / tool.completed |
| approval_requested / approval_resolved | approval.started / approval.completed |
| compaction_start / compaction_end | compaction.started / compaction.completed |
| agent_settled | agent.settled |
| queue_changed | queue.changed |
| prompt_timing | prompt.timing.updated |
| context_budget | context.budget.updated |
| skills_loaded | skill.loaded |
| permission_changed | permission.changed |
| session_title | session.title.updated |
| nested_tool.started / nested_tool.completed | tool.nested.started / tool.nested.completed |

## Compatibility and IDs

New records use this catalog. Existing records are not rewritten: the version-1 envelope, directory layout and recovery reader remain compatible. Reopening a recording can append new names after older ones. Local consumers of earlier logs should additionally recognize the original names above and these former trace names:

| Former trace name | Current name |
| --- | --- |
| run.cancel_requested | run.cancel.requested |
| model.input_projection | model.input.projected |
| model.stream | model.stream.received |

sessionId identifies conversation storage, runId identifies one execution lifetime, operationId identifies a narrower operation and parentOperationId links its parent. eventId and seq identify a record and its capture order. These are local Loop fields; runId and operationId are not W3C trace-id/span-id values and are not propagated as traceparent headers. Prompt timing IDs remain per input and provider request IDs are not synthesized.

## Limits and sources

Names describe observed logical activity, not raw HTTP attempts, provider-internal retries or unsupported tool progress. See [local telemetry](telemetry.md) for capture modes, storage and failure isolation, and [local trace format](../../../telemetry/src/docs/local-traces.md) for the envelope.

[Session adapter](../core/telemetry/session-trace.ts) / [tests](../core/telemetry/session-trace.test.ts), [model adapter](../core/telemetry/model-trace.ts) / [tests](../core/telemetry/model-trace.test.ts).
