# Permissions and Approvals

The permission menu sits beside the attachment button in the toolbar below the text input. Approval cards above the composer review operations that need additional authority. Enforcement stays in coding-agent core.

## Usage

In **Settings → General → Permission**, choose the default access level for new Web sessions across all projects. The dropdown uses the same shield icons and per-level descriptions as the chat permission menu, with a selected checkmark and orange Full access styling. The server persists it across reloads and restarts. With no Web override, the configured SDK default applies; the built-in default is Read only. Full access requires a separate confirmation explaining that future Web sessions will inherit unrestricted host access. Cancel or Escape dismisses only the confirmation. Loading and saving disable the selector; errors are displayed and loading can be retried. Only a successful save updates the selection. Existing sessions, including drafts, retain their permissions. This Web setting does not change CLI or SDK defaults. See [storage and API](../../backend/docs/permissions.md#new-session-default).

Open the permission pill and choose Read only, Workspace write, or Full access while connected and idle. The menu shows descriptions and a checkmark for the saved selection; Full access uses orange text. Arrow keys navigate, Escape closes, and clicking outside dismisses the menu. The built-in default is Read only; restored sessions keep their saved preset. Selecting Full access opens a separate modal explaining file, terminal command and network access. Only its confirmation button submits the change; Cancel or Escape leaves the saved preset unchanged. Saving disables duplicate actions, and errors stay visible in the dialog. A failed save preserves the effective preset. The choice applies only to this session, not other sessions, projects or global defaults. Draft sessions persist their choice with their first saved user message.

The sidebar shows a yellow dot to the left of a waiting session title and a static clock icon instead of the right-hand spinner, with a Waiting for approval tooltip. Both remain visible when switching sessions and clear after a decision or cancellation.

Approval cards have no expiry countdown; built-in tool requests wait for a decision or cancellation. The summary uses Allow this operation with ${mode} permissions: ${justification}, with a localized prefix and the model's original justification, falling back to the policy reason when no justification is supplied. Core supplies workspace-write for file targets inside the workspace and danger-full-access for outside targets; unsandboxed shell approvals display danger-full-access and keep host file, network and environment access visible. These labels describe the operation's access tier; file approvals still authorize only the exact replacement, and session permissions stay unchanged. Older file snapshots without a tier and custom requests without an operation use Allow this operation once. Operation details is collapsed initially and expands the working directory, canonical target, full scope and complete validated arguments, including proposed content or replacements. All model text and arguments are escaped plain text without Markdown execution or truncation.

Approval cards have an orange rounded border and a tinted Waiting for approval header with a status dot. The summary sits in the card body, with expandable details below. Choose Deny or Allow once using the right-aligned rounded buttons; Allow once uses a black background with white text. The layout adapts to narrow screens and both color themes. Allow once resumes only the waiting operation and leaves the permission preset unchanged. It does not confirm execution success; ordinary tool results report that separately. Stop generating cancels the run and pending approval. Expired, cancelled, rejected and unavailable requests display their outcome and remove decision buttons.

## Connection lifecycle

The active view opens /events?approvals=1 for its session. Multiple pages share one backend handler and the first valid decision wins. Cards and responses carry both the session ID and request ID. Switching sessions closes only the old view's connection and never transfers a decision or permission choice.

Buttons disable while disconnected or submitting. Existing requests remain pending when switching sessions, closing the page or disconnecting, for as long as the server and session remain alive. Reconnecting restores them without a grace deadline. New requests raised with no connected interactive view still fail closed. Stop generating or session/server shutdown cancels the waiting operation; restarting the server does not restore pending approvals.

Successful decision and permission requests update the view through the existing SSE connection. After a failed or uncertain HTTP result, the client reconnects for fresh state. It does not automatically retry an approval or overwrite newer events with an HTTP snapshot. Duplicate or stale decisions return a conflict and refresh the view. Server restart restores saved permissions and history, with no pending requests or grants.

## Limits

There is no always-allow control, persistent approval grant, durable approval audit, project-level default, or remote user-account permission system. The most recent approval outcome is retained in the live snapshot as compact metadata only. Full access and an approved shell invocation intentionally use the host user's authority; see [core permissions](../../../../coding-agent/src/docs/permissions.md).

## Source and tests

- [Permission selector](../components/chat/SessionPermissions.tsx) / [tests](../components/chat/SessionPermissions.test.tsx).
- [Default permission setting](../components/settings/PermissionSettings.tsx) / [tests](../components/settings/PermissionSettings.test.tsx), [dropdown](../components/settings/DefaultPermissionSelect.tsx), and [settings hook](../hooks/useGeneralSettings.ts).
- [Approval card](../components/chat/ApprovalCard.tsx) / [tests](../components/chat/ApprovalCard.test.tsx), and [expandable operation details](../components/chat/ApprovalDetails.tsx).
- [Session approvals](../components/chat/SessionApprovals.tsx) / [tests](../components/chat/SessionApprovals.test.tsx).
- [Decision hook](../hooks/useApprovalDecision.ts), [permission hook](../hooks/useSessionPermission.ts), and [SSE hook](../hooks/useSessionEvents.ts).
- [HTTP contract](../../backend/docs/permissions.md).
