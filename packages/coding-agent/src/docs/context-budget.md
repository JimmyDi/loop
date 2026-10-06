# Context Budget

Every main model request is assembled and checked in coding-agent before dispatch, including requests after tool results. The check counts the system prompt with project instructions, projected host runtime context, conversation content, tool calls/results, and enabled tool schemas. Agent keeps ordinary message history and its sequential tool loop.

## Usage

No extra configuration is required. Given an existing session, observe the estimate and handle overflow through the public API:

```typescript
import { ContextBudgetExceededError } from "@loop/coding-agent";
import type { AgentSession } from "@loop/coding-agent";

const run = async (session: AgentSession): Promise<void> => {
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "context_budget") {
      console.log("Estimated input tokens:", event.budget.estimatedInputTokens);
      console.log("Reserved output tokens:", event.budget.reservedOutputTokens);
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      console.log("Provider usage:", event.message.usage);
    }
  });
  try {
    await session.prompt("Explain the project structure.");
  } catch (error) {
    if (!(error instanceof ContextBudgetExceededError)) throw error;
    console.log("Input limit:", error.budget.inputLimit);
    console.log("History retained:", session.state.messages.length);
  } finally {
    unsubscribe();
  }
};
```

The example does not construct a session or call a model by itself. See [SDK](sdk.md) for session construction. CLI and Web use the same core check and report its error through their existing failure paths; there is no separate budget gauge in the UI.

## Budget reference

`ContextBudget`, exported from the public entry, contains:

| Field | Meaning |
| --- | --- |
| `provider`, `model` | Identity of the model used for this estimate. |
| `contextWindow` | Configured model window. |
| `systemTokens` | Estimated system prompt, including discovered instructions. |
| `messageTokens` | Estimated projected messages, including host runtime snapshots. |
| `toolTokens` | Estimated enabled tool definitions and JSON schemas. |
| `estimatedInputTokens` | Sum of the three input categories. |
| `reservedOutputTokens` | The configured model's full `maxTokens`, including reasoning within that ceiling. |
| `safetyTokens` | Five percent of the window, rounded up, capped at 4096. |
| `inputLimit` | Window minus output reserve and safety, clamped to zero. |
| `remainingInputTokens` | Window minus reserve, safety and estimated input; negative means overflow. |
| `fits` | True when remaining input capacity is at least zero. |

For a 32,000-token window and 4096-token response ceiling, safety is 1600 and input capacity is 26,304. Exactly 26,304 estimated input tokens fit; 26,305 reject. The stream receives an explicit `maxTokens` equal to the reserved response ceiling. Native adapters may impose a smaller output cap or ignore unsupported output-cap fields; this reserve is not a promise of generated response length.

Both model capacities must be positive safe integers. Correct custom model metadata in [model configuration](models.md) when its actual limits differ from the defaults. Reserving the full output ceiling can leave little or no input capacity for models with large output ceilings. This stage has no separate response-budget setting.

## Lifecycle and errors

Assembly clones the normalized request and projects retained permission context without editing conversation history. Budget measurement follows projection, so hidden host text consumes capacity too. `context_budget` fires before each main dispatch and also for a rejected request. `state.contextBudget` returns an isolated copy of the latest estimate; it clears at the start of an accepted prompt and after a successful model switch. Estimates are transient and are not saved in JSONL or recalculated merely by reopening a session.

An over-budget request throws `ContextBudgetExceededError` with a cloned `budget`. It never calls the main model or creates a synthetic assistant response. It still retains the accepted user input and all completed messages/results, then attempts the ordinary history save. A new host snapshot is persisted only once a request reaches dispatch. Cancellation before dispatch also records no new snapshot. Save failures use the existing pending-save and `flush()` workflow; combined execution/save failures reject with `AggregateError`.

If a tool result makes the next request exceed the budget, that result and its matching call remain saved. Select a model with a larger window while idle, then send a continuation prompt, or start a new session with a smaller input. Continuing history does not rerun completed tools. Shortening only the next prompt cannot remove an earlier oversized message. Loop does not automatically compact or truncate conversation messages.

Actual provider counts and costs stay in completed `AssistantMessage.usage`, including input, output, cache read/write and any reported reasoning breakdown. They are available through `message_end`, `state.messages` and saved/restored history, including provider error responses that contain usage. Reasoning is a subset of output, not an additional count. Missing provider counts are not invented. Local estimates are separate from billing usage and do not use a small earlier usage value to skip counting current instructions or schemas. Cancellation before a completed response retains no final usage beyond the existing stream/history contract.

## Estimation limits

This is a heuristic preflight, not a tokenizer or a provider guarantee. ASCII text averages four characters per token. Each non-ASCII Unicode character receives half its UTF-8 byte length rounded up, giving larger allowances for CJK and emoji. Messages have a 16-token envelope; system and tool groups also have overhead. JSON content includes tool arguments and replayed text/thinking signatures. Local tool details, timestamps and billing metadata are excluded. Images receive 1200 tokens each regardless of base64 length; model-specific image resolution and encoding can make actual usage different.

Provider translation, sampling settings, hidden templates and tokenization can differ from these estimates. Safety reduces that uncertainty without eliminating it. Requests that pass can still fail at the provider, and conservative estimates can reject a request that a provider could fit. Existing [tool output limits](tools.md) still apply before a tool result enters history.

Background title generation uses its own bounded input/output policy and does not pass through the main request assembler, receive permission snapshots, or emit main context budgets. This stage adds no compaction, resource integrations or context-policy extension hooks.

## Source

[Request assembly](../core/model-request.ts), [budget and error](../core/context-budget.ts), [dispatch](../core/model-runtime.ts), [session lifecycle](../core/agent-session.ts), [budget tests](../core/context-budget.test.ts), [assembly tests](../core/model-request.test.ts), and [session regression tests](../core/agent-session.test.ts).
