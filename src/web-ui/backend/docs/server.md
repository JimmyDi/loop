# Server Startup

One Bun service provides the React page and same-origin API, listening only on the IPv4 loopback address `127.0.0.1`. There is no separate frontend development server or cross-origin proxy.

## Start

Run these commands from the project root:

```bash
bun run-dev
bun run-dev --port 3081 --no-open
bun src/web-ui/main.ts --help
```

| Argument | Behavior |
| --- | --- |
| --port | Defaults to 3080; accepts 0–65535, with 0 requesting an available system-assigned port |
| --no-open | Start the service without automatically opening a browser |
| --help, -h | Print usage without loading the frontend or starting a server |

Unknown arguments and invalid ports report errors. SSH environments do not open a browser automatically. An occupied port causes a startup error instead of silently selecting another port.

## Readiness and Development Updates

startServer creates project storage, provider settings, a session registry, and routes. `/` uses a Bun HTML import; `/api/*` goes to the backend router, and other paths return 404. After startup, main requests and consumes the homepage to verify frontend compilation before printing the URL and opening a browser.

Non-production mode enables React/CSS HMR and browser console forwarding. `bun run-dev` explicitly uses development mode. The backend has no watch/hot reload; restart after changing routes or service logic. A newly updated frontend connected to an old backend may receive 404 for new APIs.

Saving model settings uses the running API and requires no restart. This differs from updating backend source. See [provider configuration](providers.md).

## Shutdown and Storage

main handles SIGINT/SIGTERM by rejecting new session operations, waiting for registered loading/configuration work, cancelling sessions, attempting pending saves, and closing subscriptions and the server. Failed shutdown saves report an error and set a failing exit code. Closing the server is not proof that data was saved.

The data root comes from coding-agent's getAgentDir, defaults to `~/.loop`, and can be set with `LOOP_DATA_DIR`. Project and provider configuration live in its web-ui subdirectory; sessions use the SDK's existing sessions directory. Closing the browser does not shut down the service.

## Limits

This is a local single-user service run from source, without public listening, a login system, or a background daemon. Web build generates browser assets, but production asset distribution, root `loop web` dispatch, and the `npx loop web` release path are not complete.

## Source and Tests

- [server.ts](../server.ts), [main.ts](../../main.ts) / [startup tests](../../main.test.ts).
- [Argument parsing](../startup/arguments.ts) / [tests](../startup/arguments.test.ts).
- [Browser opening](../startup/open-browser.ts) / [tests](../startup/open-browser.test.ts).
- [Session registry](../session-registry.ts) / [tests](../session-registry.test.ts).
