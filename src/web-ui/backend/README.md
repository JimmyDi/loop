# Loop Web Backend

A local Bun service exposes projects, sessions, model configuration, and SSE to the browser. It calls the SDK only through the public coding-agent entry point. Model requests, tool loops, and history storage remain in the underlying coding-agent, Agent, and Pi AI layers.

## Start

Run from the project root and open the printed local URL:

```bash
bun run-dev --no-open
```

One service provides both frontend and backend; they do not need separate processes. Configure a model in the browser before creating a session. See the [Web README](../README.md) for installation. Backend source changes require restarting the command.

## Features

| Feature | Documentation |
| --- | --- |
| Local listening, startup arguments, and shutdown | [Server startup](docs/server.md) |
| Project registration, persistence, and directory selection | [Projects and directories](docs/projects.md) |
| Session loading, command exclusion, cancellation, and saving | [Session commands](docs/sessions.md) |
| Event frames, snapshots, replay, and connection lifecycle | [SSE events](docs/events.md) |
| Custom models, credential storage, and runtime updates | [Provider configuration](docs/providers.md) |
| Local request checks, input limits, and error contracts | [HTTP boundaries](docs/http.md) |

Each page covers one implemented feature, its interfaces, lifecycle, limits, and source/tests. See the [frontend documentation](../frontend/README.md) for browser workflows and [coding-agent](../../coding-agent/docs/session-format.md) for the complete session storage format.

## Validation

Run colocated tests for affected features. Documentation-only changes need link and content validation. To check the entire backend, run from the project root:

```bash
bun test src/web-ui/backend
```

The startup entry has separate [main.test.ts](../main.test.ts) coverage. Tests use temporary data, local model substitutes, or injected SDK interfaces without real model credentials. Frontend and backend share the [workspace manifest](../package.json); the backend has no separate package.json.
