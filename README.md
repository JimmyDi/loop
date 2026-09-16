# Loop

Loop is a local first, provider agnostic harness for running one agent with explicit tools, skills, MCP connectors, schedules and event streams. It is designed as a clean open source starting point: the default provider is deterministic and does not contact a remote service.

## Quick start

Requirements: [Bun](https://bun.sh/) 1.1 or newer.

```sh
bun install
bun run src/cli/index.ts run "hello"
bun run src/cli/index.ts run --json "hello"
bun test
bun run desktop:dev
```

The default `mock` provider returns a stable response for local development. The Electron shell is a thin local window over the same Bun API and renderer. To use the optional `pi-ai` adapter, install and configure the package for your environment, then set `LOOP_PROVIDER=pi-ai`, `LOOP_MODEL`, and `PI_AI_API_KEY`. Secrets belong in a local `.env` file; `.env` is ignored and never part of the project.

## CLI

```text
loop run "hello"
loop run --file task.md
loop run --provider pi-ai --model model-id "hello"
loop run --json "hello"
loop tools list
loop skills list
loop mcp list
loop schedule create --name daily --cron "0 9 * * *" --prompt "Summarize today"
loop schedule list|pause|resume|delete
loop doctor
```

## Electron development

The minimal Electron shell starts the local Bun API, opens a context-isolated `BrowserWindow`, and renders a small React/TSX app. It exposes only `run`, `history`, and `health` through the preload bridge. Start it with:

```sh
bun run desktop:dev
```

The shell intentionally excludes Assistant-only gateway, remote access, tray, private service, and task-management features.

## Architecture

- `src/core`: single agent loop, cancellation signal, lifecycle events and tool execution.
- `src/providers`: stable provider interface, mock provider and optional `pi-ai` adapter.
- `src/extensions`: tool, skill and MCP registration contracts.
- `src/permissions`: capability policy and approval events for write, network, shell and external service tools.
- `src/storage`: local JSON stores for threads, runs, artifacts, approvals and schedules.
- `src/server`: small Bun API shared by desktop and web clients.
- `src/desktop`, `src/web`, `public`: integration seams for Electron and PWA packaging.

The project intentionally contains no personal tasks, logs, caches, credentials, private endpoints or bundled connectors.

## Development

Use `bun run typecheck`, `bun test`, and `bun run check`. Extensions should use neutral example data and declare capabilities. Changes that add network, shell, write or external service behavior should go through the capability policy.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
