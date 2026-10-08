# Loop Web UI

Browser application over the public coding-agent SDK. All implementation, styles, tests and local validation configuration live in this directory.

## Startup

Web is a private pnpm workspace package. Frontend and backend share its package.json and the root pnpm-lock.yaml. Install from the repository root with pnpm install.

Run pnpm dev from the root for development. Vite middleware serves React/CSS with HMR on the same loopback port as the Node HTTP API. A separate `tsx watch` process restarts the Node backend when its loaded source files change; frontend source is excluded from backend watching. Arguments are forwarded: pnpm dev --port 3081 --no-open.

For production, run pnpm build and node dist/bin.js web from the root. The compiled package serves prebuilt assets without Vite or a source checkout. Help works without opening a server: node dist/bin.js web --help.

The public root package is `@loop-harness/loop` and provides the `web` subcommand. Start the published version with `npx @loop-harness/loop web`. Node.js 24+ is required; Bun and frontend build tools are not required.

## Model connection

Open **Settings → Models**. Add a built-in provider with its API key, or a custom provider with an ID, base URL, protocol and model IDs. Custom gateways support Chat Completions, Responses and Anthropic Messages, optional model discovery, and no authentication for local services.

Save, then create a conversation. The model pill beside Send opens model search and supported reasoning effort choices. It remembers both for new conversations; the old header selector is removed. Existing conversations keep their model and remain readable after provider removal; select another configured model to continue. Finish active runs and pending saves before changing providers.

Configuration is stored in the server's local user data directory, outside the project. API keys are not returned to the frontend or persisted in browser storage. No `.env` is needed for this workflow. Only providers configured in Settings → Models are available to Web sessions. See [provider configuration](src/backend/docs/providers.md) for storage, API and lifecycle details.

If a sent message stays in the waiting state, check the model endpoint and server network. A connection failure is shown in the current status and retained on its assistant message when history is reopened. Authentication checks during session creation do not prove model endpoint connectivity.

## Features

- Project registration, rename/removal, canonical directory deduplication and per-project conversation history.
- macOS directory picker, browser directory navigation and typed paths.
- Independent SDK sessions, HTTP commands, SSE snapshots/replay, abort and pending-save recovery.
- React chat components, editable drafts, model-authored updates, collapsed tool batches, Markdown and code copy.
- English/Chinese interface, responsive sidebar, session navigation and model selection.
- Frontend configuration of an OpenAI-compatible custom provider, including local gateways.

Components use arrow functions and have matching CSS/test files. Hooks and utilities are separated by responsibility. `architecture.test.ts` checks public imports, component companions and a 200-line implementation limit.

## Feature documentation

Each side has a README index and a Markdown-only docs directory, following the Agent and coding-agent documentation structure. Each page describes one implemented feature, its usage, contracts, lifecycle, limits and source/tests.

| Area | Entry point |
| --- | --- |
| Browser interaction, messages, model settings, streaming and preferences | [Frontend](src/frontend/README.md) |
| Server startup, projects, sessions, SSE, providers and HTTP boundaries | [Backend](src/backend/README.md) |

This directory's docs folder contains the shared [design](src/docs/DESIGN.md). Feature documentation lives under frontend and backend. Saving Provider settings and switching an existing session are separate operations; see [frontend model settings](src/frontend/docs/models.md) for the current behavior.

The approved [Loop icon delivery](src/docs/assets/loop-brand/README.md) contains the design source, export sizes, platform assets and usage guidelines.

## Validation

From the root, run pnpm typecheck, pnpm check and pnpm build. Run affected files with pnpm exec vitest run followed by their package-relative paths. Startup integration tests require the production build. See the [development guide](../../docs/development.md).
