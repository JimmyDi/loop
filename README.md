# Loop

Loop is a local-first, single-agent harness. CLI, SDK and Web share persistent coding sessions, an in-memory agent loop and a model runtime.

## Start locally

Requires Node.js 24+ and pnpm 11. Install dependencies and start the Web UI:

```bash
pnpm install
pnpm dev
```
The browser opens when the loopback service is ready. Configure providers in Settings → Models.

Development serves React through Vite middleware on the same port as the API; frontend changes use HMR and backend changes restart the process.

For the CLI, configure LOOP_AI_PROVIDER, LOOP_MODEL and LOOP_AI_API_KEY in the environment or a local .env, then run pnpm coding-agent. See [models](packages/coding-agent/src/docs/models.md) for compatible gateways and configuration.

Build and launch the production application:

```bash
pnpm build
node dist/bin.js web
node dist/bin.js web --port 3081 --no-open
node dist/bin.js --help
```

The root npm package is named loop. Once it is published under an authorized registry name, the user command is npx loop web. Packaging support does not mean a registry release has occurred.

## Architecture

| Package | Responsibility |
| --- | --- |
| packages/agent | In-memory model and sequential tool loop |
| packages/coding-agent | Sessions, permissions, tools, persistence, CLI and SDK |
| packages/web-ui | Frontend, backend and shared protocol |

All three are private workspace packages with independent manifests and public exports, bundled into the root distribution. Root bin.ts and sdk.ts are application distribution entries. Commands flow Web/CLI/SDK → coding-agent → agent → model API. Events flow upward through subscriptions. Only the model-runtime module configures and injects the model runtime; the loop initiates requests. pnpm check:architecture enforces dependencies and rejects cycles and private imports.

Loop remains single-agent. Reliability, safety, recoverability and usability determine maturity.

## Documentation

| Area | Entry |
| --- | --- |
| Agent API, events and tools | [Agent](packages/agent/README.md) |
| SDK, CLI, models and sessions | [Coding-agent](packages/coding-agent/README.md) |
| Browser application and server | [Web UI](packages/web-ui/README.md) |
| Development, build and distribution | [Development](docs/development.md) |

## Validation

Run pnpm typecheck, pnpm check, pnpm build and pnpm test. Use affected tests by default; the build is required for distribution startup tests. Model tests use synthetic local responses. The CLI PTY test requires Python 3. Confined shell tests require macOS Seatbelt or Linux Bubblewrap.

See [Changelog](CHANGELOG.md), [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) and [License](LICENSE).

The software is MIT-licensed. The Loop icon remains reserved under the [brand asset policy](packages/web-ui/src/docs/assets/loop-brand/BRAND-ASSETS.md); guide fonts retain their [SIL OFL 1.1 license](packages/web-ui/src/docs/assets/loop-brand/fonts/OFL.txt).
