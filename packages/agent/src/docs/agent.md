# Agent API

Use Agent when a host needs a reusable in-memory conversation. The host supplies model configuration, authentication and streaming.

## Create and prompt

This example accepts a configured model and stream function. Calling runExample makes a real request.

```typescript
import { Agent } from "@loop/agent";
import type { AgentOptions, StreamFn } from "@loop/agent";

export const runExample = async (model: AgentOptions["model"], streamFn: StreamFn) => {
  const agent = new Agent({
    model,
    systemPrompt: "You are a helpful assistant.",
    tools: [],
    streamFn,
    maxTurns: 4,
  });
  const answer = await agent.prompt("Hello!");

  for (const part of answer.content) {
    if (part.type === "text") console.log(part.text);
  }
};
```

For a custom URL and streamed output, use the runnable [Agent sample](../agent.sample.ts).

## Options

| Option | Contract |
| --- | --- |
| `model` | Required `Model<Api>`. |
| `streamFn` | Required [model stream function](agent-loop.md#model-boundary); there is no default registration. |
| `systemPrompt` | Optional text sent separately from conversation history. |
| `messages` | Optional initial `Message[]`, including user, assistant, and tool results. |
| `tools` | Optional readonly array of [AgentTool](tools.md). Defaults to none. |
| `streamOptions` | `SimpleStreamOptions` without `signal`; Agent owns cancellation. |
| `maxTurns` | Optional positive integer limiting model requests within each prompt. |

## Instance API

| Member | Result |
| --- | --- |
| `prompt(content: PromptContent): Promise<AssistantMessage>` | Runs all model/tool turns and returns the final successful assistant message. |
| `messages: Message[]` | Isolated snapshot of completed history, including tool calls and results. |
| `isRunning: boolean` | Whether a prompt is currently running. |
| `subscribe(listener): () => void` | Adds an [event listener](events.md); returns unsubscribe. |
| `abort(): void` | Signals cancellation; await the prompt promise to observe completion. |

PromptContent reuses UserMessage content: a string or an array of text/image blocks. Images use base64 data and mimeType. Image-only prompts are supported; an empty input or image input with a text-only model rejects before history changes or model calls. Content is copied before processing.

## History and concurrency

Construction copies initial history. Each accepted non-empty prompt appends one user message; completed assistant and tool messages are appended by the loop. Streaming drafts are not history entries. Changing the returned `messages` array does not change Agent state.

Repeated prompts on the same instance retain history. A new instance starts empty unless `messages` is provided. System prompt and tool declarations are rebuilt for requests and do not accumulate in history.

For persistence, capture `agent.messages` after the run settles and pass that snapshot into a new Agent. The [coding session](../../../coding-agent/src/docs/sessions.md) handles this automatically. Concurrent prompts reject with `Agent is already running`; there is no input queue or runtime model setter. Construct a new Agent to change model configuration.

## Source

[agent.ts](../agent.ts), [types.ts](../types.ts), and [agent.test.ts](../agent.test.ts). See [cancellation and errors](cancellation.md) for rejected prompts and recoverable history.
