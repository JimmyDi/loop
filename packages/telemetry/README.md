# Loop telemetry

`@loop/telemetry` is a private Node.js workspace package for local execution records, JSONL storage, credential filtering and retention. It has no dependency on Agent, coding-agent, Web or a model provider. The root distribution bundles it.

The caller publishes structured facts and owns business lifetimes. This package filters records once, queues immutable serialized snapshots, batches ordered disk writes, and reports recording failures without throwing into execution.

Recording runs automatically during execution. The current scope is local files and recording status; there is no Trace viewer, response feedback action, log export or upload integration.

See [local traces](src/docs/local-traces.md) for the format, recording API, lifecycle and limits. Session integration is documented in [coding-agent telemetry](../coding-agent/src/docs/telemetry.md). Tests are colocated with each feature.

Generic schema helpers bind names to TypeScript payload contracts at compile time while keeping storage open to other producers. Event vocabulary belongs to the producer: coding-agent documents its [trace event catalog](../coding-agent/src/docs/trace-events.md). The recorder preserves supplied names and does not claim a standard tracing wire format.
