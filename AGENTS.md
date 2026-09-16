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
- Keep model access behind the provider interface. Use the mock provider for tests and examples; use the optional `pi-ai` adapter for real model access.

## Code style

- Follow `biome.json`: 2-space indentation, 100-column line width, double quotes, semicolons, trailing commas, and parentheses around arrow-function parameters.
- Run Biome formatting and checks for code changes.
- Keep one primary responsibility per file and avoid oversized modules.
- Prefer explicit types and small, composable functions.
- Keep tests colocated with the implementation they cover.

## Validation

- Run relevant tests after changes. For broad changes, run `bun test`, the Biome check, and the affected Bun build commands.
- Check CLI changes with the mock provider before completing the work.
- Remove temporary runtime data such as `.loop` fixtures created during validation.
- Scan new content for personal paths, credentials, private URLs, and other sensitive data before completing the work.

## Git and external state

- Do not run Git commands unless the user explicitly requests them.
- Do not create commits, branches, tags, pull requests, or push changes without explicit user authorization.
- Do not send messages, publish content, or modify external services unless explicitly authorized.

## Formatting details

- Treat `biome.json` as the source of truth; use `bun run format` to format and `bun run check` to validate.
- Keep one import per line. Group external or platform imports before local imports, then leave one blank line before declarations.
- Keep one blank line between top-level declarations and between logically separate JSX sections.
- Let the formatter wrap long function calls, object literals, JSX props, and conditional expressions instead of compressing them onto one line.
- Put one prop or object field per line when a JSX element or object exceeds the configured line width. Keep the trailing comma required by the formatter.
- Use two spaces for nested blocks and JSX children. Keep closing JSX tags and closing parentheses aligned with their opening expression.
- Prefer early returns for guard clauses and multiline blocks for non-trivial conditionals.
- Keep component props and shared data types explicit and colocated with the component boundary; move shared types to a dedicated `types.ts` file when reused.
- Keep one primary component, hook, or utility export per file.
