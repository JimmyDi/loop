# Local telemetry and execution traces

## Purpose and minimal usage

Trace records explain model calls, tools, approvals, queue consumption, configuration, compaction and saves independently of version-2 Session snapshots. Existing Session storage needs no migration. Recording writes only local files.

```typescript
import { createAgentSession } from "@loop-harness/loop";

const { session } = await createAgentSession({ telemetry: { mode: "content" } });
try {
  await session.prompt("Explain package.json");
  await session.flushTrace();
  console.log(session.traceStatus);
} finally {
  await session.abort();
  session.dispose();
  await session.flushTrace();
}
```

## Configuration and storage

File-backed SDK, CLI and Web sessions default to content capture. `telemetry: false` disables it; in-memory Sessions stay file-free. Options accept mode and byte limits described by the [telemetry package](../../../telemetry/src/docs/local-traces.md).

| Mode | Captured content |
| --- | --- |
| metadata | Identities, model configuration, outcomes, usage, budgets and timings; no prompts or tool bodies |
| content | Adds actual model context, final responses, tool content, selected Skills and summaries |
| stream | Adds observed native stream events without repeated growing partial messages |

Storage is `<agentDir>/traces/<workspace-hash>/<session-id>/`. Core starts best-effort inactive-log retention once per data directory per process: 30 days / 1 GiB, plus the 128 MiB Session recording limit. Only Trace directories are cleaned; Session history remains unchanged.

Deleting a conversation does not immediately delete its Trace directory; inactive traces remain until retention cleanup.

## Capture boundaries

Core adapts session events and observes configuration intent/outcome, input preparation, manual compaction and saves. Policy observations include resolved presets and file-write checks. Nested tools have observed lifetimes through the host tool bridge.

Main inputs are captured after projection and automatic compaction, before runtime dispatch. A runtime decorator observes the same stream consumer and preserves native `result()` and response objects. Summary and title calls carry separate purposes. Headers, credentials and model endpoints are not serialized; known credential patterns are filtered before storage.

`runId` lasts from accepted execution to finalization, including queued inputs. Prompt timing IDs stay per input. Stop/Resume starts a new run with a continuation link. Model, tool, approval, compaction and save operation IDs identify narrower lifetimes with parent links. Idle configuration and manual compaction need no run ID.

Stored event names follow the [Loop trace event catalog](trace-events.md), using lowercase dot-separated entity/operation/phase names and schema-bound payload types. Typed recording checks the corresponding data before mode filtering and credential redaction. The Core adapter maps business events without changing Agent or Session subscription APIs. These names and IDs are local contracts, not OpenTelemetry or W3C wire formats. Older records retain their original names.

## Lifecycle and errors

`traceStatus` is independent of outcome and pending-save state. Recording failures/drops do not fail a successful prompt. Events are filtered once and serialized when observed, then appended asynchronously in order while execution continues. Small events are batched until the next event-loop iteration or 128 events / 64 KiB of pending serialized data; segment rotation and payload boundaries split writes. They do not wait for Session completion. Metadata capture skips known content bodies before processing. Disabled or failed recording bypasses model wrapping for subsequent calls and skips event adaptation and operation-ID allocation.

`flushTrace()` waits for preceding accepted writes and updates the manifest; it can be called during a running prompt without stopping generation. It does not save conversation history, upload logs or wait for future events. Check `traceStatus` for recording errors after awaiting it; storage failures are isolated from business execution. Conversation save retries use the separate `flush()` API.

`dispose()` stays synchronous and schedules cleanup after title work ends. Await `flushTrace()` afterward to wait for final writes, file closure and writer-lock release. Runtime replacement and CLI/Web shutdown already perform this draining. SDK hosts manage their own cleanup as shown above. Trace flushing does not call fsync or guarantee power-loss durability. Missing ends and damaged records are reported.

## Local files

CLI, SDK and Web sessions use the same Core recording path. Each Session has its own event segments, payload directory, manifest, sequence and writer lock. Different Sessions can write concurrently; a second writer for the same directory is disabled without stopping business execution.

Logs stay on the machine running Loop. There is no Trace viewer, response feedback control, feedback log export or upload integration. The sidebar Feedback link opens a blank GitHub issue without transferring local data. To inspect a recording, open its JSONL files locally and follow payload references. Content mode may contain prompts, source and tool output despite credential filtering.

## Limits and sources

Capture covers logical calls and observed events, not raw HTTP or runtime-internal retries. Hidden provider data and unsupported tool progress are unavailable. Images are omitted. Recording adds bounded queue/storage costs and serialization work.

[Core adapter](../core/telemetry/session-trace.ts), [model observation](../core/telemetry/model-trace.ts), [SDK](../core/sdk.ts), [events](events.md), [Session format](session-format.md), [telemetry package](../../../telemetry/README.md).
