# Agent Loop

`runAgentLoop` performs user input → model → tools → model until the model finishes without tool calls. Agent delegates to this function; hosts may also call it directly.

## Calling the loop

The exported signature is `runAgentLoop(text, history, options, onEvent?, signal?): Promise<AssistantMessage>`.

- `history` is a mutable Pi AI `Message[]`. The loop is its sole writer during the run.
- `options` is `AgentLoopOptions`: model, explicit stream function, system prompt, tools, stream options, and optional turn limit.
- `onEvent` defaults to a no-op and is awaited.
- `signal` defaults to a fresh, non-aborted signal. Direct callers supply their own controller to cancel.

Do not append the input or returned assistant again. The loop has already written them into history.

## Request lifecycle

1. Validate input and options, check cancellation, and append the user message.
2. Normalize a copy of history through Pi AI `transformMessages` for the selected model.
3. Build `Context` from `messages`, `systemPrompt`, and tool declarations. Local `execute` functions are excluded.
4. Call `streamFn` and consume its async event iterator.
5. Read `result()` on that same stream and append the complete assistant once.
6. Reject unsupported or failed stop reasons. If there are no tools, return the assistant.
7. Execute tool calls in source order, append their matching results, and request the model again.

Tool execution does not increment the turn count; each model request does. When `maxTurns` is reached, already requested tools finish and their results remain in history, but the next model request is rejected.

## Model boundary

`StreamFn` accepts Pi AI `Model<Api>`, `Context`, and optional `SimpleStreamOptions`. It returns `AssistantMessageEventStream` or a promise of that stream.

The first await obtains the stream object; `stream.result()` returns the completed message from the same request. It does not start a second request.

Loop currently uses Pi AI 0.85.1's `Context` and `api/transform-messages` API. There is no dependency on a newer `TranscriptContext` contract. Pi AI owns provider requests, authentication integration, and provider-specific streaming parsing.

## Events and completion

A stream must finish with an AI `done` or `error` event. Closing without either rejects. Updates before `start` also reject. A stream that only supplies a final result still produces a complete message event.

Agent emits [message and tool events](events.md), with the original AI update carried inside `message_update`. Stop reasons and interrupted tool batches follow [cancellation and error rules](cancellation.md).

There is no agent-level retry, deferred polling, parallel tool execution, queue, or context compaction.

## Source

[agent-loop.ts](../agent-loop.ts), [types.ts](../types.ts), and [agent-loop.test.ts](../agent-loop.test.ts).
