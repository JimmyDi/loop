# Loop coding-agent

A CLI and TypeScript SDK built on the existing [Loop Agent](../agent/README.md). Coding-agent owns model configuration, built-in tools, resources, and persistent sessions. Every prompt creates a fresh Agent with completed history.

Import from [index.ts](src/index.ts). This private pnpm workspace package owns its dependencies and public SDK/CLI exports. The root loop distribution bundles it.

## Start

From the project root, install with `pnpm install` and configure [a model](src/docs/models.md). Then choose a consumer:

```bash
pnpm run coding-agent
pnpm run coding-agent --print "Read package.json and explain the scripts."
node --conditions=loop-source --import tsx packages/coding-agent/src/sdk.sample.ts "Hello, what time is it now?"
```

The CLI is interactive by default. The SDK sample performs one request workflow and exits; it keeps history in memory. Both default to OpenAI GPT-5.5 and support a custom URL through model configuration.

## Features

| Feature | Documentation |
| --- | --- |
| Embed Loop and call the public API | [SDK](src/docs/sdk.md) |
| Interactive commands and Print mode | [CLI](src/docs/cli.md) |
| Model selection, credentials, custom URLs | [Models](src/docs/models.md) |
| Configuration files and environment | [Settings](src/docs/settings.md) |
| Create, restore, replace, and save sessions | [Sessions](src/docs/sessions.md) |
| Preserve and restore archive membership | [Session archive](src/docs/session-archive.md) |
| Automatic titles, renaming and regeneration | [Session titles](src/docs/session-titles.md) |
| On-disk JSONL schema | [Session format](src/docs/session-format.md) |
| Stream output and observe run completion | [Events](src/docs/events.md) |
| Read, bash, edit, and write | [Tools](src/docs/tools.md) |
| Session permission presets and native file sandboxing | [Permissions](src/docs/permissions.md) |
| Request, answer and cancel host approvals | [Approvals](src/docs/approvals.md) |
| Discover project instructions | [Context files](src/docs/context-files.md) |
| Keep permission context separate from the system prompt | [Runtime context](src/docs/runtime-context.md) |

Each page covers one feature, with usage first, API or configuration reference, current behavior and limits, and links to source/tests. The README is the entry point, keeping feature details in `docs/`.

## Samples and validation

- [cli.sample.sh](src/cli.sample.sh): executable CLI usage, custom endpoint flags, and session restore.
- [sdk.sample.ts](src/sdk.sample.ts): model setup, session creation, text subscriptions, prompting, cancellation, and cleanup through public SDK exports.

Samples use real configured models and can execute enabled tools. Tests use local synthetic endpoints and temporary directories; the interactive PTY test requires Python 3.

```bash
pnpm exec vitest run packages/coding-agent/src
pnpm run typecheck
pnpm run check
```

Coding-agent supports Loop's minimal API and JSONL format. It does not implement queues, steering, compaction, extensions, skills, MCP, or RPC.
