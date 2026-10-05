# Permission Endpoints

Each SessionController owns an approval adapter and consumes the public coding-agent session APIs. The browser submits explicit decisions; it never receives an execution permit.

## HTTP contract

| Endpoint | Body or behavior |
| --- | --- |
| GET /api/settings/general | Return the effective default as permissionPreset. |
| PUT /api/settings/general | JSON permissionPreset: read-only, workspace-write or danger-full-access. Persist and return the default for future Web sessions. |
| PUT /api/sessions/:id/permission | JSON preset: read-only, workspace-write or danger-full-access. Persist before changing authority; return the session snapshot. |
| GET /api/sessions/:id/events?approvals=1 | Opt into an interactive approval connection; optional cursor follows normal SSE rules. |
| POST /api/sessions/:id/approvals/:requestId | JSON decision: allowed-once or rejected. Return the snapshot only when core accepts the decision. |

Example bodies:

```json
{ "preset": "workspace-write" }
```

```json
{ "decision": "allowed-once" }
```

Invalid preset/decision values return 400 with invalid_permission_preset or invalid_approval_decision. Busy or pending-save sessions reject permission changes with 409; pending approvals also block other commands. Decisions bypass the command lock so a paused tool can resume. Stale, duplicate, expired, wrong-session or disconnected decisions return 409 approval_not_pending. Unknown sessions return 404.

These routes share the existing [local HTTP checks](http.md): loopback Host, matching Origin when supplied, cross-site request rejection and JSON input validation. There is no account authentication or per-tab ownership; request IDs are correlation identifiers, not secrets. Same-origin interactive pages may answer the same session's requests, with first settlement winning.

## New-session default

Settings → General stores the permission default in `<agentDir>/web-ui/settings.json`, shared across projects and browser pages using this server data directory. GET and PUT use the same shape:

```json
{ "permissionPreset": "workspace-write" }
```

PUT rejects missing or invalid presets and extra fields with 400 invalid_permission_preset. Writes are serialized and atomically replace the file with mode 0600; success is returned only after persistence. A failed write does not change the previous saved default. This endpoint does not invoke a model or modify any session. There is no separate approval tool: the frontend confirms Full access before submitting PUT.

Each newly created Web session reads the default and passes it to the managed session factory. If the Web settings file is absent, the SDK settings default applies, with Read only as the built-in fallback. Invalid or unreadable Web settings report an error and prevent new-session creation instead of silently substituting permissions. Existing and restored sessions retain their own presets without reading this Web default; legacy sessions without permission metadata still restore as Read only. Existing drafts also retain the preset selected at creation. CLI and SDK defaults are unaffected. Concurrent server processes do not coordinate writes; the last atomic replacement wins.

## Handler lifecycle

Ordinary event connections and internal observers remain read-only viewers. The first explicitly interactive connection registers one handler with the session. Subsequent connections share it. Core requested/resolved events publish session.state with pendingApprovals. lastApproval records only outcome, resolution time and session/request/tool identifiers for outcome display.

After the last interactive connection disconnects, retain the handler and existing pending requests for the lifetime of the session. There is no disconnect-expiry timer. Built-in tool approvals have no deadline; custom SDK requests may explicitly opt into a timeout. New requests with no connected client fail immediately. Reconnection reuses the handler and restores pending snapshots. Responses require at least one live interactive connection. Heartbeat/backpressure or cancelled SSE connections remove only the client subscription; explicit run abort or controller disposal settles the request.

Disconnecting does not stop the model run. Closing the controller aborts the run and pending requests, releases the handler and closes event connections. A restart restores persisted session permissions but no pending approvals, outcome metadata or reusable grants.

## Scope and limits

File approval authorizes one exact replacement, with core path/content/identity rechecks. Shell approval authorizes one unsandboxed invocation and descendants with host filesystem, network and environment access. Neither changes the stored preset. There is no command-text risk classifier, automatic retry, always-allow decision or grant persistence. See [core approvals](../../../coding-agent/docs/approvals.md) for enforcement.

## Source and validation

[Session adapter](../session-approvals.ts) / [tests](../session-approvals.test.ts), [routes](../routes/sessions.ts) / [HTTP/tool integration test](../routes/sessions.test.ts), and [controller](../session-controller.ts). Tests cover connection opt-in, multiple tabs, long disconnects, reconnect, explicit SDK expiry, abort, stale/wrong-session responses, local request rejection, persisted presets and a managed write that waits for approval.

[General settings routes](../routes/settings.ts) / [tests](../routes/settings.test.ts) and [Web settings storage](../settings/web-settings.ts) / [tests](../settings/web-settings.test.ts) cover validation, fallback, atomic persistence, failure recovery, new sessions across projects, and restoration without changing existing authority.
