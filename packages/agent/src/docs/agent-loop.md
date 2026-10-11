# Agent Loop

`runAgentLoop` performs user input → model → tools → model until the model finishes without tool calls. Agent delegates to this function; hosts may also call it directly.

## Calling the loop

The exported signature is `runAgentLoop(content, history, options, onEvent?, signal?): Promise<AssistantMessage>`.

- `content` is user-message content: a string or text/image blocks; image-only input is allowed.
- `history` is a mutable `Message[]`. The loop is its sole writer during the run.
- `options` is `AgentLoopOptions`: model, explicit stream function, system prompt, tools, stream options, and optional turn limit.
- `onEvent` defaults to a no-op and is awaited.
- `signal` defaults to a fresh, non-aborted signal. Direct callers supply their own controller to cancel.

Do not append the input or returned assistant again. The loop has already written them into history.

## Request lifecycle

1. Validate input and options, check cancellation, and append the user message.
2. Normalize a copy of history for the selected model using `transformMessages`.
3. Build `Context` from `messages`, `systemPrompt`, and tool declarations. Local `execute` functions are excluded.
4. Call `streamFn` and consume its async event iterator.
5. Read `result()` on that same stream and append the complete assistant once.
6. Reject unsupported or failed stop reasons. Execute tools in source order and append matching results.
7. Await finishTurn, poll steering, and continue when tools or steering inputs are present.
8. After a response without tools, poll follow-ups; continue if present, otherwise return the final assistant.

Tool execution does not increment the turn count; each model request does. When `maxTurns` is reached, already requested tools finish and their results remain in history, but the next model request is rejected.

## Model boundary

`StreamFn` accepts `Model<Api>`, `Context`, optional `SimpleStreamOptions`, and optional `ModelInputMetadata`. It returns `AssistantMessageEventStream` or a promise of that stream. Existing stream functions can ignore the fourth argument.

The loop supplies metadata for every request. `historyMessageCount` is the number of completed history entries at dispatch, including the accepted user input. `sources[i]` identifies normalized `context.messages[i]`: a `history` source has its zero-based original `messageIndex`; a `tool-repair` source has the originating assistant's `messageIndex` and missing `toolCallId`. Failed/aborted assistants remain in history but have no request entry. Model adaptation preserves origins even when content blocks change. Metadata and temporary origin markers are separate from provider context; hosts must not forward metadata as provider messages.

The first await obtains the stream object; `stream.result()` returns the completed message from the same request. It does not start a second request.

The configured model runtime handles provider requests, authentication and stream parsing. The loop consumes its typed context and event stream.

## Events and completion

A stream must finish with an AI `done` or `error` event. Closing without either rejects. Updates before `start` also reject. A stream that only supplies a final result still produces a complete message event.

Agent emits [message and tool events](events.md), with the original AI update carried inside `message_update`. Stop reasons and interrupted tool batches follow [cancellation and error rules](cancellation.md).

There is no agent-level retry, deferred polling, parallel tool execution, queue storage, or context compaction.

## Source

The loop writes history and schedules tools sequentially. Focused internal modules handle the request boundary without adding public exports:

| Module | Responsibility |
| --- | --- |
| [agent-loop.ts](../agent-loop.ts) | Turn scheduling, history writes, event order and skipped-call pairing. |
| [validate-loop-input.ts](../validate-loop-input.ts) | Prompt, image capability, stream function and turn-limit validation before history changes. |
| [normalize-model-input.ts](../normalize-model-input.ts) | Model-compatible replay and original message indexes, including missing-result repairs. |
| [stream-model-response.ts](../stream-model-response.ts) | Request construction, native stream events, final result and iterator cleanup. |
| [execute-tool.ts](../execute-tool.ts) | Tool lookup, runtime argument validation, execution and error-result envelopes. |
| [abortable-promise.ts](../abortable-promise.ts) | Cancellable promise waits and abort-listener cleanup. |

See [types.ts](../types.ts), [loop integration tests](../agent-loop.test.ts), [normalization tests](../normalize-model-input.test.ts), [stream tests](../stream-model-response.test.ts), [tool tests](../execute-tool.test.ts), [input tests](../validate-loop-input.test.ts) and [cancellation-wait tests](../abortable-promise.test.ts).

## Scheduled inputs and checkpoints

Undefined content continues existing user history without appending input; empty user history rejects.

| Option | Boundary and contract |
| --- | --- |
| getSteeringMessages(signal) | Return native prompt content arrays before the first request and after each successful response and complete tool batch. |
| getFollowUpMessages(signal) | Return native prompt content arrays only after a successful response without tools and no steering. |
| prepareRequest(signal) | Return systemPrompt, tools and streamFn for the next request and its tools. |
| finishTurn({ message, history }, signal) | Awaited after the complete response and tool batch, before queue polling. History is an isolated snapshot. |

Callbacks are optional lower-layer contracts. Hosts provide queue storage, Skill preparation, save checkpoints and compaction; Agent has no application imports. Callbacks must cooperate with cancellation and avoid consuming inputs before preparation succeeds. A callback failure rejects the run. No polling follows model failures, cancellation or a failed finishTurn. A reached maxTurns budget does not consume another queued input; tool continuations reject, while a naturally finished response returns successfully.

Steering does not cancel streams or skip tools. Tool results precede steering user messages in history and in the next model request. One Agent and cancellation signal remain active until tool continuations, steering and follow-ups are exhausted. Hosts can return one input at a time to preserve per-input configuration and timing. See [message queue](../../../coding-agent/src/docs/message-queue.md).
