# User questions and answers

Loop exposes `request_user_input` to clarify requirements, gather preferences or constraints, and resolve implementation choices that materially affect the result. The model should investigate information available in the workspace first, decide low-impact reversible details itself, and ask when an answer requires user judgment or information it cannot discover. The tool waits for an explicit response, including skipped questions, before continuing with the answers provided. Answers never grant tool permissions.

## SDK usage

Register a handler before prompting. The host displays questions and submits answers; returning from the handler does not answer them.

```typescript
import type { AgentSession, UserInputRequest } from "@loop-harness/loop";

export const connectQuestions = (
  session: AgentSession,
  render: (request: UserInputRequest) => void,
) => session.registerUserInputHandler(render);

export const answerQuestion = (
  session: AgentSession,
  request: UserInputRequest,
  questionId: string,
  text: string,
) => session.respondToUserInput({
  sessionId: request.sessionId,
  requestId: request.requestId,
  answers: [{ questionId, type: "text", text }],
});
```

The example answers a single-question request. Multiple questions require one answer for every question in the same submission.

## Contract

The tool accepts a non-empty `questions` array. Each question contains only `title` (non-blank, at most 2,000 characters) and optional `options`. There are no question `type`, `required` or `optional` fields. Requiring `title` in the tool schema means callers must supply question text; it does not require the user to answer. Labels such as “Required” or “Optional” inside the title are plain text and do not change validation. When provided, `options` is a non-empty array of non-blank strings (at most 300 characters each): the user selects one suggestion or enters custom text. Without `options`, the question accepts free text. The first option is preselected, but never automatically submitted. Each question must receive non-blank text, a selected option or an explicit skip.

```json
{
  "questions": [
    { "title": "What should happen next?", "options": ["Continue (Recommended)", "Adjust", "Pause"] },
    { "title": "Provide the requirements." }
  ]
}
```

Put the recommended option first and keep recommendation hints inside that option string, for example `"直接继续（推荐）"` or `"Continue (Recommended)"`. Keep the title focused on the question; do not put recommendation hints in the title. Recommendation text is displayed as part of the option label.

The host request normalizes titles to `text` and assigns IDs such as `question-1` and `option-1`. SDK handlers use these request IDs when responding. Host/history contracts retain structured options and recommendation metadata for compatibility; those fields are not model tool parameters. Explicit skipping is allowed for every question.

`registerUserInputHandler(handler)` returns a detach callback. Only one handler can be registered. `respondToUserInput(response)` returns true only for the first valid answer to the current request. Wrong session/request IDs, incomplete or duplicate answers, unknown options and blank text return false without consuming the request.

```typescript
import type { UserInputAnswer } from "@loop-harness/loop";

export const answers: UserInputAnswer[] = [
  { questionId: "question-1", type: "option", optionId: "option-2" },
  { questionId: "question-2", type: "text", text: "Example" },
];
```

Free text allows 10,000 characters. The tool result includes original questions, outcome, accepted answers and resolution time. Completed answers enter normal tool history and session persistence. Hosts should not request secrets through this workflow.

## Lifecycle and errors

`state.pendingUserInputs` and `user_input_requested` / `user_input_resolved` events expose transient waiting state. The sequential tool waits for an answer, cancellation or handler loss. No deadline or default answer is applied. The question tool is available for direct calls; it is omitted from Codemode scripts so script deadlines cannot interrupt human waiting. Missing/failing handlers and detaching resolve unavailable; cancellation stops the run. Full access does not affect questions.

Queued messages remain queued while waiting. Valid answers return through the corresponding tool result and continue the same model run. Preselection never submits automatically.

Interactive CLI displays one question at a time: enter a choice number or custom text, press Enter to confirm the first option, use `/skip` to skip any question, or `/abort` / Ctrl+C to stop. Print mode does not register a handler.

Web displays a question card immediately above the mounted chat composer. Each page contains one question. Explicitly selecting a choice saves it and advances to the next question, while selecting on the last page still requires Send. Header arrows browse without submitting; Next advances after an answer and Send submits the complete set from the last page. Skip explicitly records a skipped answer for any question, then advances or submits on the last page. If earlier questions remain unanswered, the final Skip returns to the first incomplete question. Blank text cannot advance or send; it is never silently converted to a skip. Stop cancels the run; answers appear in collapsed history cards. Refresh and reconnect restore questions while the server remains alive.

## Limitations

Pending tool waits are not persisted or resumed across process restarts. Restored sessions retain completed answers, but interrupted requests cannot accept old responses. Model judgment about when to ask is guided, not guaranteed. Web cards appear above the composer while waiting; voice and attachments are not answer inputs. Plan mode reuses these questions for requirement clarification; see [Plan mode](plan-mode.md).

## Source and tests

- [Service](../core/user-input/user-input-service.ts) and [tests](../core/user-input/user-input-service.test.ts)
- [Tool](../core/user-input/user-input-tool.ts) and [tests](../core/user-input/user-input-tool.test.ts)
- [Types](../core/user-input/types.ts) and [validation](../core/user-input/validation.ts)
- [Session integration tests](../core/agent-session.test.ts)
- [CLI adapter](../modes/interactive/interactive-user-input.ts) and [tests](../modes/interactive/interactive-user-input.test.ts)
- [Approvals](approvals.md), [events](events.md), [queue](message-queue.md)
