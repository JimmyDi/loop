# Context Budget

Every main model request is assembled and checked in coding-agent before dispatch, including requests after tool results. The check counts the system prompt with project instructions, projected host runtime context, conversation content, tool calls/results, and declared tool schemas. MCP schemas stay outside initial declarations and are counted as message content when emitted through Codemode. Agent keeps ordinary message history and its sequential tool loop.

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

The example does not construct a session or call a model by itself. See [SDK](sdk.md) for session construction. CLI and Web use the same core check and report its error through their existing failure paths. Web’s Compact command shows the estimated input/window percentage with a matching progress ring; unsent drafts and reserved response tokens are excluded from that percentage.

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
| `reservedOutputTokens` | Desired request output capacity before context-based clamping, including native fixed-thinking adjustments. Defaults to the model ceiling. |
| `requestOutputTokenLimit` | Optional output cap observed in the final provider payload; not generated tokens or usage. Absent before payload inspection or when no cap is declared. |
| `safetyTokens` | Five percent of the window, rounded up, capped at 4096. |
| `inputLimit` | Window minus output reserve and safety, clamped to zero. |
| `remainingInputTokens` | Window minus reserve, safety and estimated input; negative means overflow. |
| `fits` | True when remaining input capacity is at least zero. |

For a 32,000-token window and 4096-token response ceiling, safety is 1600 and input capacity is 26,304. Exactly 26,304 estimated input tokens fit; 26,305 require reduction before dispatch. Automatic compaction starts at 23,673.6 estimated input tokens (ninety percent of input capacity), whenever an older complete turn can be summarized. The stream receives the caller cap, bounded by the model ceiling, rather than the thinking-adjusted reserve; this prevents reasoning capacity from being added twice. The native adapter can lower the final cap when its own context estimate leaves less room, but this does not lower the desired preflight reserve or bypass overflow checks.

Both model capacities must be positive safe integers. Correct custom model metadata in [model configuration](models.md) when its actual limits differ from the defaults. SDK session creation accepts an optional positive-safe-integer `maxTokens` for main requests; it is session-local and not saved in JSONL. Omitting it retains the model ceiling. Switching models clamps the caller cap to the new model ceiling and recomputes the reserve for the selected reasoning effort. CLI and Web continue using the model ceiling; this change adds no settings controls.

For example, `maxTokens: 16000` with fixed-budget Anthropic reasoning at `medium` reserves 24,192 tokens under a sufficiently large model ceiling, using the native adapter's thinking calculation. Adaptive Anthropic reasoning and OpenAI reasoning share the requested output capacity instead of adding that fixed budget. Responses has a minimum cap of 16 tokens. OpenAI-compatible sampling overrides are included conservatively and must be positive safe integers within the model ceiling. Unknown protocols and Responses configurations that disable output caps reserve the full model ceiling.

Before a main or summary request is sent, a composed `onPayload` callback inspects output-cap fields after any caller replacement or mutation. It rejects invalid caps or caps above the reserve before network dispatch; omission rejects when a smaller-than-model reserve was used. Otherwise a main request emits an updated `context_budget` with `requestOutputTokenLimit` when available, keeping the original reserve and input limit. No payload bodies are retained. The callback cannot prove a provider honors its declared limit, and injected runtimes must invoke it for payload verification.

## Lifecycle and errors

Assembly clones the normalized request and projects retained permission context without editing conversation history. Budget measurement follows projection, so hidden host text consumes capacity too. `context_budget` fires before each main dispatch and also for a rejected request. `state.contextBudget` returns an isolated copy of the latest request estimate. An accepted prompt clears it until preflight measures the new request. For nonempty restored history, successful compaction, model/permission changes and save recovery, core recomputes an idle estimate from the retained summary/messages, saved Skill expansions and legacy runtime context, current system instructions and ready tool declarations. This local estimate requires no authentication, model request or storage write. It filters failed/aborted assistant replies; provider normalization can change the actual request further. Estimates are transient, stay out of JSONL and are not provider usage. Empty sessions and restored unavailable-model placeholders have no percentage; history remains readable until a configured model is selected. No-work compaction preserves the preceding estimate.

At ninety percent of the input limit, preflight attempts [automatic compaction](compaction.md#automatic-policy) before dispatch. It remeasures the complete candidate, saves strictly reducing checkpoints and permits at most one emergency pass when still over the hard limit. An over-budget request that cannot be reduced sufficiently throws `ContextBudgetExceededError` with a cloned `budget`. It never calls the main model or creates a synthetic assistant response. It still retains the accepted user input and all completed messages/results, then attempts the ordinary history save. Prepared host snapshots and system checkpoints are persisted at main dispatch finalization or atomically with a successful automatic checkpoint before dispatch. Cancellation before either point records no new snapshot; a completed checkpoint save remains durable even if the main request is subsequently cancelled. Save failures use the existing pending-save and `flush()` workflow; combined execution/save failures reject with `AggregateError`.

If a tool result makes the next request exceed the budget, automatic compaction runs before that continuation; the result and its matching call remain saved even if the request ultimately fails. While idle, try manual [compaction](compaction.md) if the summary request fits, select a model with a larger window, or start a new session with a smaller input. Continuing history does not rerun completed tools. Shortening only the next prompt cannot remove an earlier oversized message. Compaction replaces older projected input with a summary without deleting or truncating original conversation messages.

Actual provider counts and costs stay in completed `AssistantMessage.usage`, including input, output, cache read/write and any reported reasoning breakdown. They are available through `message_end`, `state.messages` and saved/restored history, including provider error responses that contain usage. Reasoning is a subset of output, not an additional count. Missing provider counts are not invented. Local estimates are separate from billing usage and do not use a small earlier usage value to skip counting current instructions or schemas. Cancellation before a completed response retains no final usage beyond the existing stream/history contract.

## Estimation limits

This is a heuristic preflight, not a tokenizer or a provider guarantee. ASCII text averages four characters per token. Each non-ASCII Unicode character receives half its UTF-8 byte length rounded up, giving larger allowances for CJK and emoji. Messages have a 16-token envelope; system and tool groups also have overhead. JSON content includes tool arguments and replayed text/thinking signatures. Local tool details, timestamps and billing metadata are excluded. Images receive 1200 tokens each regardless of base64 length; model-specific image resolution and encoding can make actual usage different.

Provider translation, sampling settings, hidden templates and tokenization can differ from these estimates. Safety reduces that uncertainty without eliminating it. Requests that pass can still fail at the provider, and conservative estimates can reject a request that a provider could fit. Existing [tool output limits](tools.md) still apply before a tool result enters history.

Background title generation uses its own bounded input/output policy and does not pass through the main request assembler or emit main context budgets. Manual and automatic [compaction](compaction.md) use separate tool-free requests; their checks reserve a caller cap of up to 4096 tokens rather than the main model ceiling, applying the same output policy and payload guard. Provider-overflow recovery is not implemented.

## Source

[Request assembly](../core/model-request.ts), [budget and error](../core/context-budget.ts), [output policy and payload guard](../core/models/output-budget.ts), [dispatch](../core/model-runtime.ts), [session lifecycle](../core/agent-session.ts), [budget tests](../core/context-budget.test.ts), [output-policy tests](../core/models/output-budget.test.ts), [assembly tests](../core/model-request.test.ts), and [session regression tests](../core/agent-session.test.ts).
