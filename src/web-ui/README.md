# Loop Web UI

Browser application over the public coding-agent SDK. All implementation, styles, tests and local validation configuration live in this directory.

## Status

Web is a private Bun workspace. Its frontend and backend share `package.json`; the root owns the workspace declaration, core dependencies and one shared `bun.lock`. Run dependency installation from the repository root. Bun manages any workspace `node_modules` links automatically.

Install and start development from the project root:

```bash
bun install
bun run-dev
```

The same `bun run-dev` command also works inside `src/web-ui`. Development mode enables browser HMR for React and CSS. Backend code changes require restarting the command. Startup arguments are forwarded:

```bash
bun run-dev --port 3081 --no-open
```

The equivalent source entry is:

```bash
bun src/web-ui/main.ts
```

```bash
bun src/web-ui/main.ts --port 0 --no-open
```

The help entry works without frontend dependencies:

```bash
bun src/web-ui/main.ts --help
```

The eventual distribution command is `npx loop web`. npm package ownership, root CLI dispatch, build packaging and publishing remain outside this directory-only implementation. Bun must be installed; npx does not install Bun.

## Model connection

Open **Model settings** at the bottom of the sidebar, then enter a provider name, API Base URL, model ID (default `gpt-5.5`) and API key. For a local gateway that disables authentication, choose **No authentication**. Use a base URL such as `http://localhost:8080/v1`, without `/chat/completions`.

Save, then create a conversation. New conversations use this provider automatically. Existing open conversations retain their selected model; select the configured `loop-custom` model in the model menu. Settings take effect without restarting the server. Finish active runs and pending saves before updating settings.

Configuration is stored in the server's local user data directory, outside the project. API keys are not returned to the frontend or persisted in browser storage. No `.env` is needed for this workflow. Built-in models can still use the coding-agent environment configuration as a fallback. See [provider configuration](backend/docs/providers.md) for storage, API and lifecycle details.

If a sent message stays in the waiting state, check the model endpoint and server network. A connection failure is shown in the current status and retained on its assistant message when history is reopened. Authentication checks during session creation do not prove model endpoint connectivity.

## Features

- Project registration, rename/removal, canonical directory deduplication and per-project conversation history.
- macOS directory picker, browser directory navigation and typed paths.
- Independent SDK sessions, HTTP commands, SSE snapshots/replay, abort and pending-save recovery.
- React chat components, editable drafts, actual thinking blocks, tool results, Markdown and code copy.
- English/Chinese interface, responsive sidebar, conversation tabs and model selection.
- Frontend configuration of an OpenAI-compatible custom provider, including local gateways.

Components use arrow functions and have matching CSS/test files. Hooks and utilities are separated by responsibility. `architecture.test.ts` checks public imports, component companions and a 200-line implementation limit.

## Feature documentation

Each side has a README index and a Markdown-only docs directory, following the Agent and coding-agent documentation structure. Each page describes one implemented feature, its usage, contracts, lifecycle, limits and source/tests.

| Area | Entry point |
| --- | --- |
| Browser interaction, messages, model settings, streaming and preferences | [Frontend](frontend/README.md) |
| Server startup, projects, sessions, SSE, providers and HTTP boundaries | [Backend](backend/README.md) |

This directory's docs folder contains only the shared [design](docs/DESIGN.md) and [license notes](docs/ATTRIBUTION.md). Feature documentation lives under frontend and backend. Saving Provider settings and switching an existing session are separate operations; see [frontend model settings](frontend/docs/models.md) for the current behavior.

## Validation

From the repository root:

```bash
bun run --cwd src/web-ui test
bun run --cwd src/web-ui typecheck
bun run --cwd src/web-ui check
bun run --cwd src/web-ui build
```

The build produces browser assets in `src/web-ui/dist/frontend`; npm packaging and production asset serving are still separate work. For the full repository checks:

```bash
bun test
bun run typecheck
bun run check
```
