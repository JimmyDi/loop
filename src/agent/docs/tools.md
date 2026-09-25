# Agent Tools

An Agent tool combines a model-visible declaration with a local execution function. The host passes tools when constructing an Agent or calling the loop.

## Declare a tool

This declaration can be used in the `tools` option. Imports are relative to the project root.

```typescript
import type { AgentTool } from "./src/agent";

const echo: AgentTool = {
  name: "echo",
  description: "Return the supplied text.",
  parameters: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  execute(parameters, signal) {
    signal.throwIfAborted();

    return [{ type: "text", text: String(parameters.text) }];
  },
};
```

`AgentTool` reuses Pi AI's `Tool` fields `name`, `description`, and `parameters`. Its `execute(parameters, signal)` returns `ToolResultMessage["content"]` or a promise of that content, including standard text/image blocks. Agent creates the tool-result envelope.

## Execution

Only declarations enter the model request. Each returned tool call is matched by name, validated using Pi AI `validateToolArguments`, and executed locally with the validated arguments and the run's cancellation signal.

Calls execute sequentially in the order returned by the assistant. Each result retains its `toolCallId` and `toolName`. After the batch, the model receives both the assistant tool calls and their results.

Unknown tools, invalid arguments, and execution exceptions become `isError: true` results. The model may then recover in another turn. Cancellation takes priority and prevents a new request.

## Boundaries

Agent has no built-in filesystem or shell tools. [Coding-agent tools](../../coding-agent/docs/tools.md) provide read, bash, edit, and write. There are no progress callbacks, tool hooks, or parallel tools.

Tools must observe the signal. Cancellation cannot undo a completed external effect, and Agent does not forcefully interrupt an uncooperative execution function. See [cancellation](cancellation.md).

## Source

[types.ts](../types.ts), [agent-loop.ts](../agent-loop.ts), and [agent-loop.test.ts](../agent-loop.test.ts).
