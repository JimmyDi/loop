# Loop Agent Instructions

## Project scope

- Work inside this Loop project only.
- Keep changes scoped to this project; do not modify unrelated workspaces.
- Keep the project single-agent; do not add multi-agent orchestration, delegation trees, or agent-to-agent messaging.
- Do not add personal data, credentials, private endpoints, private repository details, real task data, logs, caches, screenshots, or machine-specific absolute paths.

## Runtime and dependencies

- Use Bun instead of Node.js, npm, pnpm, yarn, Vite, or Express.
- Use `bun install` to install dependencies.
- Use `bun run <script>` for package scripts.
- Use `bun test` for tests.
- Use `bun build` for bundling.
- Prefer Bun APIs such as `Bun.file`, `Bun.serve`, and `bun:sqlite` where applicable.
- Use Pi AI as the only real model entry point. Configure models and inject `streamFn` in `coding-agent`; consume the native Pi AI event stream in `agent`. Keep synthetic responses inside the corresponding `*.test.ts` file.

## Code style

- Follow `biome.json`: 2-space indentation, 100-column line width, double quotes, semicolons, trailing commas, and parentheses around arrow-function parameters.
- Run Biome formatting and checks for code changes.
- Keep one primary responsibility per file and avoid oversized modules.
- Prefer explicit types and small, composable functions.
- Keep tests colocated with the implementation they cover.

## Dependency and call direction

- Application commands flow downward: CLI/SDK -> `coding-agent` -> `agent` -> Pi AI.
- The terminal entry lives in `coding-agent/cli.ts` and uses core instance APIs.
- Cross-layer imports must use the lower layer's public `index.ts`; do not import its internal files.
- `agent` must not import `coding-agent`.
  These restrictions also apply to type imports, re-exports and dynamic imports.
- coding-agent/core and its SDK entry must not depend on cli.ts, main.ts, cli/ or modes/.
  Terminal modes depend on core; the SDK must work without terminal side effects.
- Lower layers publish events, streams or subscription callbacks defined by their own contracts.
  Upper layers subscribe and update their own state. Lower layers must not import, instantiate,
  or directly invoke upper-layer services or UI handlers; registered listeners are allowed.
- `coding-agent/core/models/model.ts` may import Pi AI to resolve model configuration, and
  `coding-agent/core/model-runtime.ts` may wire the Pi AI stream function injected into `agent`.
  The agent loop initiates model calls. Other coding-agent files may import Pi AI types only.
- Keep production module specifiers statically resolvable. Do not route dependencies through
  test files, files outside `src`, or computed imports to bypass these boundaries.
- `src/coding-agent/index.test.ts` checks these boundaries. Run `bun run check:architecture`
  after changing imports or module structure; this check also runs in `bun run check` and `bun test`.

## Validation

- Run relevant tests after changes. For broad changes, run `bun test`, the Biome check, and the affected Bun build commands.
- Keep each feature test beside its feature file, using `feature.test.ts` for `feature.ts`. Write any test-only Provider or fixture directly in that test file instead of adding shared mock or testing modules.
- Remove temporary runtime data such as `.loop` fixtures created during validation.
- Scan new content for personal paths, credentials, private URLs, and other sensitive data before completing the work.

## Git and external state

- Do not run Git commands unless the user explicitly requests them.
- Do not create commits, branches, tags, pull requests, or push changes without explicit user authorization.
- Do not send messages, publish content, or modify external services unless explicitly authorized.

## Formatting details

- Treat `biome.json` as the source of truth; use `bun run format` to format and `bun run check` to validate.
- Keep one import per line. Group external or platform imports before local imports, then leave one blank line before declarations.
- Keep one blank line between top-level declarations and logically separate blocks.
- Let the formatter wrap long function calls, object literals, and conditional expressions instead of compressing them onto one line.
- Put one object field per line when an object exceeds the configured line width. Keep the trailing comma required by the formatter.
- Use two spaces for nested blocks. Keep closing parentheses aligned with their opening expression.
- Prefer early returns for guard clauses and multiline blocks for non-trivial conditionals.
- Keep data types explicit and colocated with their feature; move shared types to dedicated type files when reused.
- Keep one primary responsibility per file.
- Keep two top-level source boundaries: `coding-agent` and `agent`.
- The coding-agent CLI uses core instance methods and subscriptions.
  SDK consumers use the public coding-agent entry.
- Follow Pi entry points under coding-agent/core: sdk.ts, agent-session.ts,
  agent-session-runtime.ts, session-manager.ts, and model-runtime.ts. Split helpers and
  types into focused subfolders. Keep terminal entry points and modes inside coding-agent;
  do not recreate a separate top-level cli directory.
- Keep exactly four implementation files in src/agent: types.ts, agent-loop.ts, agent.ts
  and index.ts, with colocated tests. Keep the API usage sample in agent.sample.ts beside them;
  it is not part of the public exports. Do not add a separate examples directory, helper
  directories or placeholder modules.
- Keep the minimal Pi-style loop in agent/agent-loop.ts. It owns history writes, consumes
  Pi AI streams and result(), validates tool arguments with Pi AI, and executes tools sequentially.
  Agent owns in-memory history, subscriptions, running state and cancellation.
- Keep streamFn explicit and return the final AssistantMessage from prompt(). Reject concurrent
  prompts, model errors, cancellation, truncation, deferred responses and exhausted maxTurns.
  Completed history excludes streaming drafts. Pair skipped tool calls before the next request.
- Do not add steering, follow-up, queues, persistence, retries, compaction, tool progress, hooks
  or provider implementations to agent. Application persistence stays in coding-agent.
- Reuse Pi AI message, model and stream types; preserve the original AI event in message updates.
  Do not import application or UI implementations into agent. Add resource integrations
  under coding-agent/core only when requested; do not add unused scaffolding.
- Retain upstream attribution in THIRD_PARTY_NOTICES.md for adapted Pi code.
- Keep one Bun project. Do not add nested package manifests, dependency installations, or a
  top-level `packages` directory. Use public `index.ts` files for internal module boundaries.
