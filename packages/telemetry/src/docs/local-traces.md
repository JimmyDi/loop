# Local traces

## Purpose and usage

Record execution evidence independently from conversation state. This package does not make model calls, execute tools, upload data, or replay operations.

```typescript
import { TraceRecorder } from "@loop/telemetry";

const recorder = await TraceRecorder.open("./local-traces/example", "example-session");
recorder.record({ type: "run.started", runId: "example-run", operationId: "example-run" });
recorder.record({ type: "run.completed", runId: "example-run", operationId: "example-run", data: { outcome: "success" } });
await recorder.close();
console.log(recorder.status);
```

## API and limits

- `TraceRecorder.open(directory, sessionId, options?)`: initializes a single writer or returns a disabled recorder with error status.
- `record(input)`: filters and serializes an immutable snapshot synchronously, then queues it without awaiting disk.
- `enabled`: lightweight recording-state check; false after close or a recording failure.
- `status`: mode, enabled, complete, queue bytes, dropped-event count, last written sequence and a safe error code.
- `flush()`: drains accepted writes and updates the manifest; no fsync guarantee.
- `close()`: idempotently drains and releases ownership; calls after close do not reopen the writer.
- `pruneTraces(root, { maxAgeDays, maxTotalBytes })`: removes recognizable inactive records oldest first; defaults to 30 days / 1 GiB. Live writers are preserved.

Recorder defaults: content mode, 16 MiB queued bytes, 128 MiB per Session, 8 MiB payload ceiling and 8 MiB event segments. Metadata mode skips known content fields before reading or redacting their bodies; producers additionally allowlist business fields. Coding-agent selects native stream events only in stream mode. Filtering occurs once at the recorder boundary, and the writer reuses serialized content. Closed/failed recorders and already-full queues skip payload processing; determining whether a new event fits remaining space still requires serialization.

## Typed producer schemas

`defineTraceEvent<Data>(description)` associates a payload type with event metadata. `defineTraceSchema({ version, events })` preserves event-name literals. `createTypedTraceRecord(schema, sink)` binds the schema to a storage sink and checks names, required fields, types and extra top-level fields. `createTypedTraceBegin(schema, callback)` infers operation names and payloads from events ending in .started; it types the existing operation-start callback without managing lifetime or generating IDs.

```typescript
import { TraceRecorder, defineTraceEvent, defineTraceSchema, createTypedTraceRecord } from "@loop/telemetry";

const schema = defineTraceSchema({
  version: 1,
  events: {
    "example.completed": defineTraceEvent<{ count: number }>("Example completed"),
  },
});
const recorder = await TraceRecorder.open("./local-traces/example", "example-session");
const record = createTypedTraceRecord(schema, (input) => recorder.record(input));
record("example.completed", { count: 1 });
await recorder.close();
```

Payload types are erased at runtime; schema metadata serializes only version, names and descriptions. Helpers perform no runtime validation, filtering, failure handling or disk writes; the bound sink retains those responsibilities. Core binds them to its best-effort recorder. Consumers of persisted or redacted records must still check data before using it. Existing open `TraceRecorder.record()` remains available.

`SchemaTraceObservation<Schema>` derives a discriminated union of producer payloads whose own type field matches a schema event name. Core uses this type to forward complete save and permission observations without splitting identical recording calls into branches.

## Format

Each row in `events-000001.jsonl` and later segments is a version-1 event with Session/event IDs, sequence, timestamp, type and optional run/operation/parent IDs. Data over 16 KiB moves to `payloads/<event-id>.json`; oversized payloads have explicit omission markers. Images are omitted. `manifest.json` records mode, start/close times, sequence watermark, next sequence, drops and completeness. Directories use mode 0700 and new files 0600.

Sequences describe capture order; operation relationships describe causality. Missing ends remain open. A complete manifest means no known capture loss, not successful operations. Trace schema and Session schema are independent.

The type field is producer-defined; this storage package does not rename or validate business vocabulary. Coding-agent uses its [trace event catalog](../../../coding-agent/src/docs/trace-events.md). Its local operation IDs and JSONL records are not an OTLP or W3C Trace Context format. Existing version-1 records keep their original event names when reopened.

## Lifecycle and errors

A serialized queue writes payloads before referring events while execution continues. Small events are coalesced until the next event-loop iteration, or admitted to the write queue sooner at 128 events or 64 KiB of pending serialized data. Event-segment writes combine adjacent lines; rotation and payload boundaries split batches. Successful portions advance the written watermark; a failed remainder counts as dropped records. Limits drop records and mark capture incomplete. Disk failures disable further capture and drain queued work without changing application outcomes. Each Session has independent files, sequences and queues. PID locks reject concurrent writers for the same directory; dead owners can be reclaimed. An unclean prior close marks reopened recording incomplete. An internal reader checks existing records and restores sequence watermarks; damaged logs disable append without editing originals.

`record()` schedules writes automatically; events are not held until Session completion or an explicit flush. `flush()` and `close()` immediately admit the pending batch to the write queue. Awaiting `flush()` waits for previously accepted writes and the manifest update. It does not wait for later events or end a running operation. Storage errors are reflected in `status`; a resolved flush does not mean recording succeeded.

Flush does not call fsync and cannot guarantee power-loss durability. Hard crashes can lose queued records and manifest updates. Background work must settle before close.

## Content and local inspection

Producers allowlist model configuration rather than serializing credentials or headers. The recorder filters common credential keys, bearer/basic credentials, private keys and recognized token patterns before disk writes. This cannot identify every secret embedded in arbitrary source or tool text.

Open event segments locally and follow payload references to inspect captured content. There is no public query API, Trace viewer, feedback-copy API or upload integration. Logs are not attached to GitHub issues. Credential filtering does not classify all names, phone numbers, paths or private business data; local content logs can contain sensitive working data.

## Related sources

[Typed schema helpers](../schema.ts) / [tests](../schema.test.ts), [Recorder](../recorder.ts), [internal recovery reader](../reader.ts), [redaction](../redaction.ts), [retention](../retention.ts). Colocated tests cover ordering, concurrent Sessions, limits, corruption, ownership and failures.
