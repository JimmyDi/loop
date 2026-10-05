# Loop Agent Instructions

## Project scope

- Work inside this Loop project only.
- Keep changes scoped to this project; do not modify unrelated workspaces.
- Keep the project single-agent; do not add multi-agent orchestration, delegation trees, or agent-to-agent messaging.
- Evaluate maturity by single-agent reliability, safety, recoverability, and usability, not by multi-agent support.
- Do not add personal data, credentials, private endpoints, private repository details, real task data, logs, caches, screenshots, or machine-specific absolute paths.

## Runtime and dependencies

- Use Node.js 24 or newer for runtime and pnpm for workspace dependencies and scripts.
- Use Vite for frontend development/builds, tsdown for Node ESM and declarations, and Vitest for tests.
- Keep production code free of Bun globals, imports and runtime assumptions.
- Use the configured model runtime as the only real model entry point. Configure models and inject `streamFn` in `coding-agent`; consume the native model event stream in `agent`. Keep synthetic responses inside the corresponding `*.test.ts` file.

## Code style

- Follow `biome.json`: 2-space indentation, 100-column line width, double quotes, semicolons, trailing commas, and parentheses around arrow-function parameters.
- Run Biome formatting and checks for code changes.
- Keep one primary responsibility per file and avoid oversized modules.
- Prefer explicit types and small, composable functions.
- Prefer arrow function expressions in JavaScript and TypeScript files, including JSX/TSX, for standalone functions and callbacks; use `const` or `export const` for named functions. Keep regular functions or method syntax when required by semantics, such as generators, overloads, dynamic `this`, or declaration hoisting.
- Keep tests colocated with the implementation they cover.

## Dependency and call direction

- Application commands flow downward: Web/CLI/SDK -> `coding-agent` -> `agent` -> model API.
- The terminal entry lives in `coding-agent/cli.ts` and uses core instance APIs.
- Cross-layer imports must use the lower layer's public `index.ts`; do not import its internal files.
- `agent` must not import `coding-agent`.
  These restrictions also apply to type imports, re-exports and dynamic imports.
- coding-agent/core and its SDK entry must not depend on cli.ts, main.ts, cli/ or modes/.
  Terminal modes depend on core; the SDK must work without terminal side effects.
- Lower layers publish events, streams or subscription callbacks defined by their own contracts.
  Upper layers subscribe and update their own state. Lower layers must not import, instantiate,
  or directly invoke upper-layer services or UI handlers; registered listeners are allowed.
- coding-agent/core/model-runtime.ts may import the model runtime dependency to resolve model configuration and wire the stream function injected into agent.
  The agent loop initiates model calls. Other coding-agent files may import model runtime types only.
- Keep production module specifiers statically resolvable. Do not route dependencies through
  test files, files outside the owning package source, or computed imports to bypass these boundaries.
- `scripts/architecture.test.ts` checks these boundaries. Run `pnpm run check:architecture`
  after changing imports or module structure; this check also runs in `pnpm run check` and `pnpm exec vitest run`.

## Capability ownership

- `agent` stays the minimal model and sequential tool loop, with in-memory history, events,
  running state, and cancellation. Do not place application capabilities in this layer.
- `coding-agent/core` owns permission policy and enforcement, context management, recovery,
  and resource integrations. Keep these capabilities independent of terminal and Web code.
- CLI and Web own human-facing approval interactions, review workflows, and status display.
  They consume core APIs and events and submit user decisions through core contracts;
  permission enforcement must not depend on a particular UI.
- These are placement rules for requested capabilities, not claims that all are implemented.
  Do not add placeholder APIs, unsupported controls, or integrations to satisfy this ownership map.

## Feature documentation

- Keep Markdown-only `docs/` directories under both `packages/agent/src` and `packages/coding-agent/src`. Each page covers one implemented feature; do not add placeholder pages for unsupported capabilities.
- Use each module's README as the entry point and feature index. Keep the root README focused on startup and architecture, linking to detailed feature pages.
- Organize feature pages around purpose, minimal usage, API/configuration reference, lifecycle and errors, current limitations, and related source/tests where applicable. Organize documentation by topic and describe Loop's actual contracts.
- Use relative links and language-tagged code fences. Make commands copyable; use public imports in consumer examples and placeholders for credentials or machine-specific values.
- Update the relevant feature page when its API or behavior changes. Check Markdown links and TypeScript examples without making real model calls.

## Changelog maintenance

- Maintain the root [CHANGELOG.md](CHANGELOG.md) as the release history for this workspace. Keep exactly one `## [Unreleased]` section at the top, followed by releases in reverse chronological order. Agent, coding-agent, and Web UI changes share this file; identify the affected surface in each entry.
- As part of completing an implemented feature, fix, or compatibility change, update `## [Unreleased]` automatically in the same task. Do not wait for a release or a separate reminder, and do not ask permission for this local documentation edit. Before an authorized PR creation or update, reconcile the entries with the final implemented behavior.
- Read the full Unreleased section first. Use only applicable subsections, in this order: `### Breaking Changes`, `### Added`, `### Changed`, `### Fixed`, `### Removed`. Reuse existing subsections and omit empty ones.
- Describe the user-visible or public API outcome concisely in English. Combine related follow-up edits into the existing entry instead of appending a running conversation or commit log. Correct or remove pending entries if the implementation changes or is reverted. Preserve unrelated entries.
- Record behavior changes, public API/configuration changes, compatibility requirements, and actionable fixes. Pure formatting, tests, internal refactors with no observable impact, and routine documentation edits do not need an entry; explain the omission briefly in the PR when applicable.
- Breaking changes must explain the migration or link to it. Add issue/PR links only when their public URLs are verified and relevant. Do not include personal paths, credentials, private endpoints, user data, or validation logs.
- Keep all new entries under Unreleased. Never invent historical releases or infer a release date from `package.json`. Existing released sections are immutable.
- Only when release preparation is explicitly requested, move accumulated entries to a new `## [X.Y.Z] - YYYY-MM-DD` section immediately below Unreleased using the confirmed release version and date, and leave a fresh, empty `## [Unreleased]` at the top. Changelog maintenance does not authorize version bumps, Git commands, commits, tags, pushes, PRs, or publishing.

## Validation

- Default to targeted tests covering the changed behavior: run `pnpm exec vitest run <affected test files>`, including directly affected consumers and regression tests. Do not run the full repository suite by default or merely because a task is finishing or a PR is being prepared.
- Expand testing only when the user explicitly requests it or a concrete dependency, failure, or cross-cutting change cannot be verified with a scoped selection. Explain the reason before running the broader set; a large diff alone is not sufficient.
- Keep required Biome, type, architecture, and affected Node and Vite build checks appropriate to the change. These checks do not require a full test run. For Markdown-only instruction/documentation changes, check the edited content and links; do not run application tests or builds unless executable examples or behavior are affected.
- Once relevant checks pass, do not repeat or broaden them without new edits, failures, or unresolved evidence.
- Keep each feature test beside its feature file, using `feature.test.ts` for `feature.ts`. Write any test-only Provider or fixture directly in that test file instead of adding shared mock or testing modules.
- Remove temporary runtime data such as `.loop` fixtures created during validation.
- Scan new content for personal paths, credentials, private URLs, and other sensitive data before completing the work.

## Git and external state

- Do not run Git commands unless the user explicitly requests them.
- Do not create commits, branches, tags, pull requests, or push changes without explicit user authorization.
- Do not send messages, publish content, or modify external services unless explicitly authorized.

## Pull request titles

- Before creating or renaming a PR, validate its title against Conventional Commits: `<type>[optional scope][!]: <summary>`.
- Allowed lowercase types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Use a non-empty, concise summary describing the final change. Scope is optional; use `!` only for breaking changes.
- Choose the type by the primary change: `feat` for new capabilities, `fix` for bug fixes, `refactor` for restructuring, and `chore` for maintenance.
- Examples: `feat(coding-agent): add session recovery`, `refactor!: simplify Loop to CLI and SDK`, `chore: update development dependencies`.
- Correct a nonconforming proposed title before creating the PR. This naming rule does not authorize Git or GitHub actions.

## Pre-PR sensitive-data check

- Before an authorized PR creation, perform one dedicated sensitive-data check on the final outgoing content, before any authorized push or upload. Repeat the check for newly changed content before updating the PR; unchanged content does not need another scan. This check does not authorize Git commands, history rewriting, pushes, PR creation, or external uploads.
- Cover the full PR change set against its target branch, not just the most recent edit: file contents and names, new/untracked files intended for inclusion, documentation, examples, tests, fixtures, configuration, lockfiles, generated assets, and the proposed PR title/body and attachments. When Git inspection is authorized, inspect outgoing commits and their messages as well: secrets removed from the latest files may still exist in earlier commits or diff deletions.
- Check for these categories:
  - Credentials: passwords, API keys, access/refresh tokens, bearer headers, cookies, session IDs used for authentication, OAuth client secrets, private keys, signing keys, certificate bundles with private material, recovery codes, database connection strings, webhook secrets, and signed URLs.
  - Personal information: real names tied to private activity, email addresses, phone numbers, postal addresses, precise locations, usernames/account IDs, government identifiers, financial/payment information, health information, and employee/customer records.
  - Private paths and infrastructure: machine-specific absolute paths, home directories, local usernames/hostnames, internal domains/IPs/ports, private endpoints, private repository/registry URLs, organization/project identifiers, storage bucket names, and deployment or cloud-account identifiers.
  - Private working data: real prompts, conversations, task/session history, source snippets from unrelated projects, tool output, debug logs, stack traces, telemetry, database exports, backups, environment files, local settings, caches, and runtime directories such as `.loop`.
  - Hidden or embedded data: credentials in URL userinfo/query strings, encoded secrets, source maps containing local paths or source text, image/document metadata, screenshots, recordings, archives, and binary attachments. Text-only searches do not cover these formats; inspect intended attachments locally. If they cannot be inspected, stop publication and report the coverage gap.
- Use local pattern searches and available local secret scanners, then review contextual matches. Do not install tools, contact private endpoints, validate credentials against live services, or upload repository content to an external scanner without explicit authorization. If no scanner is available, use local searches plus manual review and state the coverage limit instead of claiming a scanner passed.
- Use synthetic fixtures and generic placeholders. Repository-relative source paths, public documentation URLs, and clearly synthetic examples are allowed; do not remove legitimate path-handling code or public API field names merely because a pattern matches. Do not whitelist realistic secrets solely because they appear in tests.
- If sensitive information is found, immediately stop PR creation or updates and any related push or upload, and report the finding. Do not automatically edit, redact, delete, or exclude affected content, rewrite history, or rotate/revoke credentials. Wait for explicit user instructions before remediation. After authorized remediation, recheck the affected outgoing content before resuming publication.
- Report only the category, a safe repository-relative location, and the blocked status, without exposing original values. If a filename or path itself contains sensitive information, redact that portion in the report. Never paste sensitive values into terminal output, PR text, comments, or reports. A passing scan is not proof that arbitrary binary or encoded content is safe; unresolved findings or uninspected outgoing material block publication.

## Formatting details

- Treat `biome.json` as the source of truth; use `pnpm run format` to format and `pnpm run check` to validate.
- Keep one import per line. Group external or platform imports before local imports, then leave one blank line before declarations.
- Keep one blank line between top-level declarations and logically separate blocks.
- Let the formatter wrap long function calls, object literals, and conditional expressions instead of compressing them onto one line.
- Put one object field per line when an object exceeds the configured line width. Keep the trailing comma required by the formatter.
- Use two spaces for nested blocks. Keep closing parentheses aligned with their opening expression.
- Prefer early returns for guard clauses and multiline blocks for non-trivial conditionals.
- Keep data types explicit and colocated with their feature; move shared types to dedicated type files when reused.
- Keep one primary responsibility per file.
- Keep two core source boundaries: `coding-agent` and `agent`. The `packages/web-ui/src` application directory contains its frontend, backend, shared protocol and `docs/`; it consumes the public coding-agent entry, and neither core layer may depend on it.
- The coding-agent CLI uses core instance methods and subscriptions.
  SDK consumers use the public coding-agent entry.
- Keep entry points under coding-agent/core: sdk.ts, agent-session.ts,
  agent-session-runtime.ts, session-manager.ts, and model-runtime.ts. Split helpers and
  types into focused subfolders. Keep terminal entry points and modes inside coding-agent;
  do not recreate a separate top-level cli directory.
- Keep exactly four implementation files in packages/agent/src: types.ts, agent-loop.ts, agent.ts
  and index.ts, with colocated tests. Keep the API usage sample in agent.sample.ts beside them;
  it is not part of the public exports. Do not add a separate examples directory, helper
  directories or placeholder modules. Feature documentation in `packages/agent/src/docs` is allowed.
- Keep the minimal sequential loop in agent/agent-loop.ts. It owns history writes, consumes
  model streams and result(), validates tool arguments with the model runtime, and executes tools sequentially.
  Agent owns in-memory history, subscriptions, running state and cancellation.
- Keep streamFn explicit and return the final AssistantMessage from prompt(). Reject concurrent
  prompts, model errors, cancellation, truncation, deferred responses and exhausted maxTurns.
  Completed history excludes streaming drafts. Pair skipped tool calls before the next request.
- Do not add steering, follow-up, queues, persistence, retries, compaction, tool progress, hooks
  or provider implementations to agent. Application persistence stays in coding-agent.
- Reuse the model runtime dependency's message, model and stream types; preserve the original AI event in message updates.
  Do not import application or UI implementations into agent. Add resource integrations
  under coding-agent/core only when requested; do not add unused scaffolding.
- Document Loop's own implementation. Do not add comparisons, design references or adaptation descriptions naming other applications. Keep dependency declarations, functional identifiers and required license notices accurate.
- Use one pnpm workspace with a shared root pnpm-lock.yaml. Install from the repository root.
- packages/agent, packages/coding-agent and packages/web-ui are private workspace packages with public exports and colocated source/tests. Their code is bundled into the public root @loop-harness/loop distribution.
- Web frontend/backend remain in the same package. Import other packages by public package name, never relative paths or internal subpaths.
- Root bin.ts dispatches CLI and Web; sdk.ts re-exports the coding-agent SDK without terminal side effects. These are application distribution entries, not core capabilities.
- Architecture checks cover declarations, type imports, re-exports, dynamic imports, undeclared dependencies and runtime cycles. Only coding-agent/core/model-runtime.ts may import model runtime dependency values to configure and inject the runtime.
- Existing style/test ownership exceptions are explicitly listed in the Web architecture test; new components require colocated companions. Translation dictionaries are data, not implementation-size targets.
