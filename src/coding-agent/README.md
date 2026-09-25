# Loop coding-agent

A CLI and TypeScript SDK built on the existing [Loop Agent](../agent/README.md). Coding-agent owns model configuration, built-in tools, resources, and persistent sessions. Every prompt creates a fresh Agent with completed history.

Import from [index.ts](index.ts). This folder belongs to the root Bun project; there is no separate package installation.

## Start

From the project root, install with `bun install` and configure [a model](docs/models.md). Then choose a consumer:

```bash
bun run coding-agent
bun run coding-agent --print "Read package.json and explain the scripts."
bun src/coding-agent/sdk.sample.ts "Hello, what time is it now?"
```

The CLI is interactive by default. The SDK sample performs one request workflow and exits; it keeps history in memory. Both default to OpenAI GPT-5.5 and support a custom URL through model configuration.

## Features

| Feature | Documentation |
| --- | --- |
| Embed Loop and call the public API | [SDK](docs/sdk.md) |
| Interactive commands and Print mode | [CLI](docs/cli.md) |
| Model selection, credentials, custom URLs | [Models](docs/models.md) |
| Configuration files and environment | [Settings](docs/settings.md) |
| Create, restore, replace, and save sessions | [Sessions](docs/sessions.md) |
| On-disk JSONL schema | [Session format](docs/session-format.md) |
| Stream output and observe run completion | [Events](docs/events.md) |
| Read, bash, edit, and write | [Tools](docs/tools.md) |
| Discover project instructions | [Context files](docs/context-files.md) |

Each page covers one feature, with usage first, API or configuration reference, current behavior and limits, and links to source/tests. The README is the entry point, keeping feature details in `docs/`.

## Samples and validation

- [cli.sample.sh](cli.sample.sh): executable CLI usage, custom endpoint flags, and session restore.
- [sdk.sample.ts](sdk.sample.ts): model setup, session creation, text subscriptions, prompting, cancellation, and cleanup through public SDK exports.

Samples use real configured models and can execute enabled tools. Tests use local synthetic endpoints and temporary directories; the interactive PTY test requires Python 3.

```bash
bun test src/coding-agent
bun run typecheck
bun run check
```

This implementation references Pi's core organization, but supports Loop's own minimal API and JSONL format. It does not implement Pi's queues, steering, compaction, extensions, skills, MCP, or RPC. See [third-party notices](../../THIRD_PARTY_NOTICES.md).
