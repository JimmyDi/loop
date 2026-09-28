# Contributing

Use Bun for installation, tests, scripts, and type checks. Keep examples synthetic and provider credentials in environment variables.

## Validation

Run only tests covering the changed behavior and directly affected consumers by default, using `bun test <affected test files>`. Do not automatically run the full suite when finishing work or preparing a PR. Broaden coverage only for an explicit request or a concrete risk that targeted tests cannot verify, and explain why. Keep applicable formatting, type, architecture and build checks; Markdown-only edits normally require content/link checks instead of application tests. See [agent validation rules](AGENTS.md#validation).

## Sensitive data before a PR

Before an authorized PR creation and before pushing its content, check the complete outgoing change set, outgoing history when inspection is authorized, PR text, and attachments locally. Check credentials, personal information, private paths and infrastructure, real conversation/task data, logs, caches, local configuration, and hidden data in generated files, metadata, archives or screenshots. Use synthetic values and repository-relative paths. If sensitive information is found, stop PR creation or updates and related pushes/uploads; do not automatically modify, redact, delete, or exclude affected content. Report only the category, a safe repository-relative location, and the blocked status, without exposing original values; redact sensitive portions of filenames or paths in the report. Wait for explicit user instructions before remediation, then recheck authorized corrections before publication. Uninspected outgoing material also blocks publication. Recheck newly changed content before PR updates, without rescanning unchanged material. The detailed scope and handling rules are in [the pre-PR sensitive-data check](AGENTS.md#pre-pr-sensitive-data-check).

## Changelog

The root [CHANGELOG.md](CHANGELOG.md) tracks changes across Agent, coding-agent, and Web UI. Update its `Unreleased` section alongside features, fixes, and compatibility changes in the same PR. Agent instructions in [AGENTS.md](AGENTS.md#changelog-maintenance) make this part of completing the task, without a separate reminder.

Use the applicable categories in order: Breaking Changes, Added, Changed, Fixed, Removed. Write concise English entries describing the effect on users or API consumers, identifying the affected surface. Include migration guidance for breaking changes. Refine the existing entry as a PR evolves; do not add one entry per edit or commit. Preserve unrelated entries, omit empty categories, and use only verified public issue/PR links.

Pure formatting, tests, internal refactoring without behavior changes, and routine documentation updates can omit an entry. Briefly explain why in the PR. Changelog entries supplement the feature documentation; update both when behavior changes.

During an explicitly requested release preparation, move the accumulated entries under the confirmed version and release date (`## [X.Y.Z] - YYYY-MM-DD`) and leave an empty `## [Unreleased]` at the top. Keep previously released sections unchanged. Recording changes does not itself create a release or authorize publishing.

This is an agent instruction workflow, not a background service. Agents need to load the repository instructions. Loop reads context files when creating a session; after changing these rules, create a new Loop session to load them. See [project context files](src/coding-agent/docs/context-files.md).

## Pull request titles

Use Conventional Commits: `<type>[optional scope][!]: <summary>`. The summary must be non-empty and describe the final change. Use lowercase types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`. Scope is optional; `!` indicates a breaking change.

Examples:

- `feat(coding-agent): add session recovery`
- `refactor!: simplify Loop to CLI and SDK`
- `chore: update development dependencies`
