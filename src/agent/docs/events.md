# Agent Events

Subscribe before prompting to receive incremental output and tool lifecycle notifications. The Agent layer exposes five event types.

## Stream text

The following subscription uses an existing Agent. It prints only new text; do not print the final answer again if it has already streamed.

```typescript
const unsubscribe = agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await agent.prompt("Hello!");
} finally {
  unsubscribe();
  process.stdout.write("\n");
}
```

The complete setup is in [agent.sample.ts](../agent.sample.ts).

## Event reference

| Event | Payload | Meaning |
| --- | --- | --- |
| `message_start` | `message` | User/tool message notification, or the beginning of an assistant draft. |
| `message_update` | `message`, `assistantMessageEvent` | Assistant draft and the corresponding Pi AI event, including text, thinking, and tool-call updates. |
| `message_end` | `message` | Completed message added to history. Inspect assistant `stopReason` before treating it as success. |
| `tool_execution_start` | `toolCallId`, `toolName`, `args` | A tool attempt is beginning; arguments have not yet passed local validation. |
| `tool_execution_end` | `toolCallId`, `toolName`, `result`, `isError` | Attempt finished with a complete tool result. |

There are no Agent `agent_start`, `turn_start`, `turn_end`, or `agent_end` events. The higher-level coding session adds [agent_settled](../../coding-agent/docs/events.md).

## Typical sequence

```text
message_start(user) → message_end(user)
message_start(assistant) → message_update* → message_end(assistant with tool calls)
tool_execution_start → tool_execution_end
message_start(toolResult) → message_end(toolResult)
message_start(assistant) → message_update* → message_end(final assistant)
```

A response may contain no text deltas, for example a tool-only response or a final-only stream. Consumers should use `message_end` to display final text that did not arrive through deltas. Rendering is separate from history writes.

Skipped calls after cancellation receive error-result message events, without execution events for tools that never ran.

## Snapshots and listeners

Pi AI partials are mutable, but Loop clones emitted events into event-time snapshots. Mutating a listener's event does not modify history or another Agent listener's event.

Agent awaits listeners in registration order. A throwing or rejected listener fails the run, and a slow listener delays it. This differs from [coding-session subscriptions](../../coding-agent/docs/events.md), whose failures are isolated.

## Source

[types.ts](../types.ts), [agent.ts](../agent.ts), and [agent.test.ts](../agent.test.ts).
