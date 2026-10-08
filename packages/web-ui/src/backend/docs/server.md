# Server Startup

One Node HTTP service provides the React page and same-origin API, listening only on the IPv4 loopback address `127.0.0.1`. Vite middleware provides frontend development assets and HMR on the same HTTP server. Production reads prebuilt assets.

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

Development mode enables Vite React/CSS HMR. `pnpm dev` runs a separate `tsx watch` process that restarts the Node backend when its loaded source files change. Frontend source is excluded from backend watching and continues to use Vite HMR. The backend runs without Node's `--watch`, avoiding dependency-tracking messages on the Codemode Worker channel. The watcher sends SIGTERM and waits for the old backend to exit before starting the next one; a backend that does not exit within five seconds is forcibly stopped. Ctrl+C stops the watcher and backend. A newly updated frontend connected to an old backend may receive 404 for new APIs.

Saving model settings uses the running API and requires no restart. This differs from updating backend source. See [provider configuration](providers.md).

## Shutdown and Storage

main handles SIGINT/SIGTERM by rejecting new session operations, waiting for registered loading/configuration work, cancelling sessions, attempting pending saves, and closing subscriptions and the server. Failed shutdown saves report an error and set a failing exit code. Closing the server is not proof that data was saved.

The data root comes from coding-agent's getAgentDir, defaults to `~/.loop`, and can be set with `LOOP_DATA_DIR`. Project and provider configuration live in its web-ui subdirectory; sessions use the SDK's existing sessions directory. Closing the browser does not shut down the service.

## Limits

This is a local single-user service with no public listening, login system or background daemon. The root distribution includes production assets and the web command. Publishing to npm requires separate authorization and package ownership.

## Source and Tests

- [server.ts](../server.ts), [main.ts](../../main.ts) / [startup tests](../../main.test.ts).
- [Development watcher regression](../../../../../scripts/dev.test.ts) covers backend restarts, frontend exclusions, Codemode calls and shutdown.
- [Argument parsing](../startup/arguments.ts) / [tests](../startup/arguments.test.ts).
- [Browser opening](../startup/open-browser.ts) / [tests](../startup/open-browser.test.ts).
- [Session registry](../session-registry.ts) / [tests](../session-registry.test.ts).
