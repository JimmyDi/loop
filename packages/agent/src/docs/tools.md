# Agent Tools

An Agent tool combines a model-visible declaration with a local execution function. The host passes tools when constructing an Agent or calling the loop.

## Declare a tool

This declaration can be used in the `tools` option. Imports are relative to the project root.

```typescript
import type { AgentTool } from "@loop/agent";

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

`AgentTool` reuses `Tool` fields `name`, `description`, and `parameters`. Its `execute(parameters, signal)` returns `ToolResultMessage["content"]` or a promise of that content, including standard text/image blocks. Agent creates the tool-result envelope.

## Execution

Only declarations enter the model request. Each returned tool call is matched by name, validated using `validateToolArguments`, and executed locally with the validated arguments and the run's cancellation signal.

Calls execute sequentially in the order returned by the assistant. Each result retains its `toolCallId` and `toolName`. After the batch, the model receives both the assistant tool calls and their results.

Unknown tools, invalid arguments, and execution exceptions become `isError: true` results. Unknown calls dispatch nothing; their error lists up to 20 currently registered names (or states that none are available) and directs the model to current declarations. Wrapper-shaped arguments never authorize or dispatch child calls. The model may then recover in another turn. Cancellation takes priority and prevents a new request.

## Completing a run from a tool

A host may set `endTurn: true` on a tool declaration. After that tool succeeds, Agent records the result, pairs subsequent calls in the same batch with skipped error results, awaits `finishTurn`, and returns the completed assistant message without another model request or queue polling. Tool failures do not terminate the run. Cancellation and persistence/listener failures retain their normal semantics. This flag is host-only and is not included in model declarations.

## Boundaries

Agent has no built-in filesystem or shell tools. [Coding-agent tools](../../../coding-agent/src/docs/tools.md) provide read, bash, edit, and write. There are no progress callbacks, tool hooks, or parallel tools.

Tools must observe the signal. Cancellation cannot undo a completed external effect, and Agent does not forcefully interrupt an uncooperative execution function. See [cancellation](cancellation.md).

## Source

[types.ts](../types.ts), [tool execution](../execute-tool.ts), [tool tests](../execute-tool.test.ts), [agent-loop.ts](../agent-loop.ts), and [loop integration tests](../agent-loop.test.ts).
