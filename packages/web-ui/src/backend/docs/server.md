# Server Startup

One Node HTTP service provides the React page and same-origin API, listening only on the IPv4 loopback address `127.0.0.1`. Vite middleware provides frontend development assets and HMR on the same HTTP server. Production reads prebuilt assets.

`GET /api/sessions/:id/images?path=...` serves local PNG, JPEG, GIF and WebP images explicitly referenced by Markdown in that session's assistant messages or streaming draft. Relative paths resolve against the project. Canonical files must remain within the project, the system temporary directory or `/tmp` on POSIX; outside symlink targets, non-regular files, unsupported signatures and files larger than 32 MiB return a sanitized 404. HEAD returns the same metadata without a body. Responses disable caching and MIME sniffing. Remote ingress requires a valid paired-device credential before invoking this route.

`GET /api/sessions/:id/files?path=...` downloads regular files up to 512 MiB explicitly linked in assistant Markdown history or the current draft. It uses the same project/temporary-directory boundaries and remote device authentication. User messages alone do not authorize access. Missing, outside-root and oversized files return `404 file_not_found`. Files stream from disk without buffering the full body; HEAD returns metadata only. Single byte ranges return 206 and Content-Range; invalid or multiple ranges return 416.

Downloads use `application/octet-stream` and attachment disposition with a UTF-8 filename. Add `preview=1` for inline MP3, WAV, M4A, AAC, OGG/OGA, FLAC, MP4, WebM, MOV, OGV or PDF; unsupported extensions still download. PDF previews require a PDF header. All responses disable caching and MIME sniffing and apply restrictive content policies; PDF responses allow the native viewer without the HTML sandbox directive. Media decoding and PDF rendering depend on the browser; no conversion or transcoding is provided.

## Start

Run these commands from the project root:

```bash
pnpm dev
pnpm dev --port 3081 --no-open
node --conditions=loop-source --import tsx packages/web-ui/src/main.ts --help
```

| Argument | Behavior |
| --- | --- |
| --port | Defaults to 3080; accepts 0–65535, with 0 requesting an available system-assigned port |
| --no-open | Start the service without automatically opening a browser |
| --help, -h | Print usage without loading the frontend or starting a server |

Unknown arguments and invalid ports report errors. SSH environments do not open a browser automatically. An occupied port causes a startup error instead of silently selecting another port.

## Readiness and Development Updates

startServer asynchronously creates project storage, provider settings, a session registry and routes, then waits for the listening socket. The Fetch API router is adapted through @hono/node-server so SSE remains streamed and response cancellation propagates. Production pages come from the build directory; development mounts Vite middleware. Icons are built without inline data URLs, with conventional favicon and Apple touch aliases. Static responses reject traversal, symlinks resolving outside the asset directory and non-GET/HEAD methods; confinement uses the operating system's path separator, including on Windows. Startup consumes the homepage before printing its URL and opening the browser.

Safari can retain icons from a previous application hosted at the same address, separately from ordinary page caching. A correct icon response does not prove that an existing Safari tab or bookmark has refreshed. After changing icon routes, restart the service and reload the page. Use a private window to compare before clearing browser data; clearing website storage can also remove local drafts and preferences. Existing pinned tabs or bookmarks may retain their own icon until recreated.

Development mode enables Vite React/CSS HMR. The pnpm dev command runs a stable gateway with a separate business worker. Backend, shared and core source edits restart the worker while the gateway retains its local listener, Tunnel and device authorization. Frontend changes use local HMR and rebuild remote assets. Worker replacement interrupts active requests and generation; browsers recover using their event cursors. See [development remote access](remote-access.md#development-restarts).

Saving model settings uses the running API and requires no restart. This differs from updating backend source. See [provider configuration](providers.md).

Frontend configuration errors do not shut down the API, session registry or remote ingress. If Vite cannot initialize, development serves the last built frontend from the Web build directory. Without that build, the homepage returns a small unavailable page with HTTP 503 and automatic refresh. Frontend requests retry Vite initialization at most once every two seconds; API and SSE requests bypass these attempts. Fix the configuration, then refresh to return to Vite. Terminal output retains the underlying error. Production still requires a working built homepage before announcing readiness.

The backend watcher excludes frontend source and package-level TypeScript build configuration, including Vite configuration and its PWA plugin. Vite manages its own configuration reloads, keeping the backend and sessions alive. Restart `pnpm dev` once after changing the watcher command itself. Backend/core source updates still restart the process and interrupt active requests; this development setup is not process-crash recovery.

## Shutdown and Storage

main handles SIGINT/SIGTERM by rejecting new session operations, waiting for registered loading/configuration work, cancelling sessions, attempting pending saves, and closing subscriptions and the server. Failed shutdown saves report an error and set a failing exit code. Closing the server is not proof that data was saved.

The data root comes from coding-agent's getAgentDir, defaults to `~/.loop`, and can be set with `LOOP_DATA_DIR`. Project and provider configuration live in its web-ui subdirectory; sessions use the SDK's existing sessions directory. Closing the browser does not shut down the service.

## Limits

This is a local single-user service with no public listening, login system or background daemon. The root distribution includes production assets and the web command. Publishing to npm requires separate authorization and package ownership.

## Source and Tests

- [server.ts](../server.ts), [main.ts](../../main.ts) / [startup tests](../../main.test.ts).
- [Development watcher regression](../../../dev.test.ts) covers backend restarts, frontend exclusions, Codemode calls and shutdown.
- [Development frontend](../http/development-frontend.ts) / [tests](../http/development-frontend.test.ts) cover failed configuration, static fallback, streaming continuity and recovery.
- [Argument parsing](../startup/arguments.ts) / [tests](../startup/arguments.test.ts).
- [Browser opening](../startup/open-browser.ts) / [tests](../startup/open-browser.test.ts).
- [Session registry](../session-registry.ts) / [tests](../session-registry.test.ts).

## Paged session history

GET /api/sessions/:id and session event snapshots include the latest three user rounds and history metadata (start, total, userStart). Message and timing indexes in events remain absolute. GET /api/sessions/:id/history?before=<message-index>&streamId=<stream-id> returns up to three preceding rounds with start, end, total, userStart and messages. Invalid boundaries return 400 invalid_history_cursor; a replaced server stream returns 409 history_changed. Authenticated remote devices may read this endpoint under the existing device and origin policy. The route pages the live controller history so pending saves and active messages remain consistent; core SessionManager.readHistory separately supports indexed disk reads. Pagination does not replay commands or reduce the model's context.
