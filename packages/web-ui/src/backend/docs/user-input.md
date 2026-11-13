# User question transport

Web sessions use the coding-agent question service independently of permissions. Interactive SSE connections (/events?approvals=1) register the shared question handler as well as the approval handler. Ordinary viewers do not enable interaction.

POST /api/sessions/:id/user-input/:requestId submits an answers array. Each answer includes questionId, type and text or optionId when applicable. All questions must be answered together. Explicit skipped answers are accepted for every question; blank text remains invalid. Valid submissions return a snapshot; stale or invalid submissions return 409 user_input_not_pending. Only the first valid response is accepted.

Pending questions appear in state.pendingUserInputs. Requested/resolved events publish state snapshots. Existing waits survive client disconnection and restore on reconnect. New questions with no interactive client resolve unavailable. Server restarts do not restore pending tool waits; completed answers remain in history.

See [core contracts](../../../../coding-agent/src/docs/user-input.md), [controller/route tests](../session-controller.test.ts), [interaction connections](../session-approvals.ts), [events](events.md) and [frontend experience](../../frontend/docs/user-input.md).
