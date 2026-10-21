# Remote Device Pairing

The Web server opens a separate random loopback ingress for the managed private tunnel. The desktop listener retains its local request checks. Remote ingress authenticates every business request before calling the same HTTP/SSE router; it never delegates tunnel controls to the remote router.

## Usage and Trust

Connect through [Remote access](remote-access.md), use the invitation automatically generated in Step 4 after connection, scan it on the phone, request access and compare the six-digit confirmation codes before approving on the computer. Microsoft service authorization still applies because the tunnel does not enable anonymous access. No Microsoft credentials are exposed to frontend code.

Approval grants the device the computer owner's chat access across registered projects, with prompt files/images, model and permission selection, queue controls, tool approvals and Agent commands. Existing core permission enforcement remains in force; the device can change a session's permission preset as the desktop can. Pair only trusted devices. No per-project, read-only or separate remote-user roles exist.

## Local API

All routes below use the desktop listener. GET status sets the process-lifetime local control cookie; mutations require that cookie and an exact local Origin. The outer local router also rejects nonlocal Host/Origin and cross-site requests.

| Request | Result |
| --- | --- |
| `GET /api/remote-access/devices` | Connection state and ephemeral connectionId, nonexpired device metadata in devices, expired metadata in expiredDevices and pending requests with comparison codes |
| `POST /api/remote-access/pairing` | Fresh `{url, expiresAt}` invitation; replaces the unused invitation |
| `POST /api/remote-access/pairing/:id` | Exactly `{approve: boolean}`; approve or decline a pending request |
| `DELETE /api/remote-access/devices/:id` | Persist revocation, then terminate that device's tracked access |

The random connectionId identifies one ingress lifetime without exposing the public URL or granting access. It is stable during status polling, changes on every reconnect and is absent while disconnected; the desktop uses it to discard stale QR results and generate a fresh code.

Invitations require an active tunnel, expire after five minutes and are consumed by one successful request. Both invitations and device credentials use independent 256-bit random secrets. Invitation URLs carry the secret in the fragment, omitted from HTTP request targets; the frontend removes it from history immediately. The six-digit code is for human comparison, not authentication. A maximum of sixteen pending requests bounds memory. Rejected, expired and already-decided requests cannot be approved.

## Remote API and Policy

| Request | Result |
| --- | --- |
| `GET /api/remote-session` | Remote authorization state; authorized devices receive sanitized metadata and a process-bound CSRF value |
| `POST /api/remote-pairing` | Exactly `{token, name}`; consumes an invitation, returns a comparison code and sets the pairing cookie |
| `GET /api/remote-pairing` | Pending/declined/expired state; an approved request exchanges the pairing cookie for the device cookie |

Both cookies use the `__Host-` prefix, Secure, HttpOnly, SameSite=Strict and Path=/. Pairing cookies expire after five minutes. Device cookies and records expire after fourteen days without automatic renewal. Duplicate or malformed credential cookies are rejected. No raw device credential is returned in JSON. The CSRF value is derived from a process-random key and the credential; a backend restart changes it.

Remote writes require the configured public HTTPS Origin and `X-Loop-CSRF`; foreign Origin or cross-site fetch metadata is rejected even for reads. The ingress accepts only its bound loopback Host or the exact public host. Loop starts the CLI with --host-header unchanged and --origin-header unchanged so the relay preserves the phone’s public Host and Origin instead of rewriting them to localhost. The default rewrites would fail the Host check on page load and the Origin check on pairing requests. Forwarded and X-Forwarded-Host headers never grant authority. Existing host processes must reconnect after this change to use the new arguments. Browser credentials remain scoped to the public hostname; reconnecting with a new hostname requires pairing again.

The allowlist serves project/session/model lists, session snapshots and SSE, new sessions in existing projects, prompts and attachments, queue/resume/abort/flush/compact, model/title/permission changes, read/pin state and tool approvals. It permits reading the installed skill catalog for the existing composer. Provider credentials, settings administration, MCP/skill installation, directory picking, project registration/removal and archive/delete endpoints are unavailable remotely. New endpoints remain denied until explicitly added. Static application assets and pairing routes are public; the frontend gate mounts business hooks only after authorization.

Responses disable caching; SSE additionally retains no-transform and X-Accel-Buffering: no so intermediaries are instructed to avoid transforming or buffering streamed chat updates. Successful responses also suppress referrers, MIME sniffing and framing. Errors use fixed codes without raw backend/CLI diagnostics. Authentication failures return 401, policy/Origin/CSRF failures 403, missing local devices 404, stale decisions/disconnected invitation requests 409, connection/pairing limits 429, unavailable ingress or failed storage 503. Other remote errors use a generic 500 code.

## Storage and Lifecycle

`<agentDir>/web-ui/remote-access/devices.json` is a strict version-1 file holding only device IDs, names, creation/expiry timestamps and SHA-256 credential hashes. Missing storage starts empty; malformed, unreadable or unsupported storage fails server startup closed. Serialized mutations write a synced private mode-0600 temporary file and atomically replace the record. No raw credentials, pairing tokens, addresses or Microsoft tokens are persisted there. Independent Web processes do not coordinate writes; use one owner process.

Approval becomes effective only after storage succeeds. A desktop approval already being saved remains durable if the tunnel disconnects during that write; it remains visible for later revocation, although its old pairing request is invalidated. Failed approval writes cannot grant access. Revocation persists first; a failed write reports failure and leaves the grant active for explicit retry. Expired records are excluded from authorization and the active devices list. Desktop status exposes their sanitized metadata separately in expiredDevices so Settings can show a red cross and offer removal, including after restart. They are pruned on the next successful approval or removed explicitly through the device DELETE route. Expired metadata never includes credential hashes and cannot authorize requests.

Requests and streams are bound to device expiry, revocation, tunnel disconnect and client cancellation. At most sixteen simultaneous business responses are allowed per device. Closing a stream cancels its source reader, unsubscribes existing SSE listeners and clears heartbeat timers. An in-flight request whose response arrives after invalidation cannot return that business response. Disconnect closes ingress before stopping/deleting the hosted tunnel. Pairing state is memory-only and resets on disconnect/restart. Already accepted commands may continue on the computer; revocation cannot undo actions or retract previously downloaded data.

## Limits and Validation

The private relay still requires service access and terminates browser TLS; it does not provide encryption that hides traffic from Microsoft. Remote ingress serves built frontend assets even when the local listener uses Vite development middleware. With pnpm dev, it uses the Web package’s dist/web directory; production keeps the packaged web directory, and an explicit assetsDir overrides the default. The remote entry never serves Vite source modules or HMR. Run `pnpm build` before remote testing and rebuild after frontend changes; pnpm dev alone does not build the remote page. A missing build returns 404 at the remote root even though the local Vite page works. Mobile layout, PWA/background delivery and network recovery polish are deferred.

Automated tests use synthetic origins, temporary private stores, injected CLI results and model streams. The business integration test reads successive model deltas over the real loopback HTTP ingress before generation completes, checks the projected phone draft, and reconnects mid-generation before receiving further live updates. It also checks the SSE anti-transformation headers. These checks do not establish real Microsoft sign-in, phone-browser compatibility or relay connectivity.

- [Ingress](../remote-access/remote-ingress.ts) / [security and SSE tests](../remote-access/remote-ingress.test.ts).
- [Existing business integration test](../remote-access/remote-business.test.ts).
- [Devices](../remote-access/remote-devices.ts) / [tests](../remote-access/remote-devices.test.ts).
- [Storage](../remote-access/device-store.ts) / [tests](../remote-access/device-store.test.ts).
- [Pairing requests](../remote-access/pairing-requests.ts) / [tests](../remote-access/pairing-requests.test.ts).
- [Local control routes](../remote-access/local-device-routes.ts) / [tests](../remote-access/local-device-routes.test.ts).
- [Allowlist](../remote-access/remote-policy.ts) / [tests](../remote-access/remote-policy.test.ts).
- [Frontend workflow](../../frontend/docs/remote-access.md).
