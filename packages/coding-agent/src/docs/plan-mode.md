# Plan mode

Plan mode investigates a task and produces a reviewable Markdown plan before implementation. It is independent of permissions: Full access does not permit project mutation while planning.

## Usage

In Web, open the composer **+** menu and select **Plan mode**. A cancellable Plan chip appears beside permissions. Running sessions cannot change mode. Submit requirements, answer clarification questions, then review the plan card. A compact confirmation card above the composer asks whether to implement the plan. Selecting **Yes, implement this plan** confirms the latest version and continues in Execute mode under existing permissions. Enter feedback and select **Send**, or press Enter, to request a revision while preserving the ordinary composer draft; Shift+Enter inserts a newline. **Skip** and the close button call the session skip API, persist a skipped plan and exit Plan mode without starting execution. Reopening or restarting does not show the execution confirmation or Plan ready badge for that version. The plan remains readable in its original turn. Sending feedback supersedes the prior plan.

Interactive CLI supports `/plan`, `/execute` and `/implement`. `/execute` only changes mode; `/implement` confirms a ready plan and starts work. `--plan` starts either CLI mode in Plan mode; Print mode outputs the final plan and exits without executing it.

```typescript
import type { AgentSession } from "@loop-harness/loop";

export const planTask = async (session: AgentSession) => {
  await session.setMode("plan");
  await session.prompt("Investigate and plan the requested change.");
  return session.state.planning?.plans.at(-1);
};

export const implementPlan = async (session: AgentSession) => {
  const plan = session.state.planning?.plans.at(-1);
  if (!plan || plan.status !== "ready") throw new Error("No ready plan");
  await session.executePlan(plan.id, plan.version);
};
```

## Contract

`SessionMode` is `execute` or `plan`. `state.planning` contains the mode and versioned plans. Each plan has an ID, version, title, Markdown body and `ready`, `superseded`, `accepted` or `skipped` status. `planning_changed` publishes the saved state.

`setMode(mode)` requires an idle session. Turning off Plan supersedes a ready plan without sending a message. New input supersedes any ready plan before model dispatch. Web renders each plan version alongside its successful submission in the originating conversation turn, rather than collecting versions at the timeline end. Historical pages use the same submission identity; results without a matching saved plan do not display a card. Plans are retained in session metadata independently of compaction; completed tool results remain in history. Old sessions default to Execute.

The model calls `submit_plan` with a non-blank title (at most 300 characters) and Markdown (at most 100,000 characters). Core assigns identity and version, saves the plan and ends the run normally. Later calls in the same batch receive skipped results. Submission does not consume follow-up input or authorize execution.

`executePlan(id, version)` requires the latest ready plan, an idle session and no queued messages. It reserves the session before persistence, rejects duplicates or stale versions, saves acceptance and starts execution with the confirmed plan. Persistence failure does not start execution. Execution failure leaves the accepted plan visible and preserves ordinary error/stop recovery. Mode restoration never starts work automatically.

Skipping requires the latest ready version, an idle session and an empty queue. It persists the skipped state before returning, rejects stale or duplicate decisions and never starts a model run. A save failure leaves the plan ready for retry. Existing permissions are preserved.

## Tools and boundaries

Plan provides built-in file reading, a read-only sandboxed shell, clarification questions, skill reading when configured, and plan submission. It does not expose write/edit, MCP, Codemode or custom tools. Direct and nested dispatches use the current planning tool identities; captured tools cannot bypass the mode guard. Shell escalation and network access are unavailable. Missing sandbox support fails rather than using an unrestricted shell. Temporary tool-output storage is host-managed and does not grant project writes.

Plan guidance is appended as a mode-specific system-prompt section. Ordinary messages, including requests to implement, clarification answers and skill instructions, do not change the mode. The host must change it through the session APIs or UI controls.

The prompt directs the model to investigate discoverable workspace facts before asking about missing requirements or consequential choices, and to decide low-impact reversible details itself. Explanation, investigation and comparison questions should receive direct answers without plan submission. Implementation requests should produce a decision-complete plan grounded in verified findings, with consequential choices resolved and assumptions made explicit. Essential unresolved requirements should be clarified rather than guessed; unavailable or skipped clarification should lead to stated assumptions or an explanation of the blocker.

Plan detail follows task complexity: simple changes need a goal, concrete steps and verification; standard changes add relevant interfaces and edge cases; complex changes may also need alternatives, stages, migration and recovery. Validation should identify expected outcomes. Revised plans should be complete replacements incorporating feedback, so each version is understandable on its own. The model submits through `submit_plan`, without creating a separate plan file. These content and workflow requirements guide model judgment; they are not semantic validation of model output. Tool restrictions and mode transitions remain enforced by core.

## Plan result presentation

Plan results use compact preview cards with a faded excerpt. Copy and download export the full Markdown. Selecting the preview or expand action opens that version in a right-side reading panel with independent scrolling; narrow screens show a full-width overlay. Closing returns to the mounted chat without clearing drafts or changing Plan mode. New revisions do not replace a previously selected version in the panel.

## Related source and tests

- [Planner](../core/planning.ts) and [tests](../core/planning.test.ts)
- [Mode prompt](../core/planning-prompt.ts)
- [Session integration](../core/agent-session.ts) and [tests](../core/agent-session.test.ts)
- [Types and validation](../core/planning-types.ts)
- [User input](user-input.md), [permissions](approvals.md), [sessions](sessions.md)
