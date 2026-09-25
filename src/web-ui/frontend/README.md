# Loop Web Frontend

A React interface for local chat. It sends commands over HTTP and receives session state over SSE. The frontend does not call models, execute tools, or read the filesystem directly; the Web backend provides these capabilities through the public coding-agent SDK.

## Start

From the project root:

```bash
bun run-dev
```

Configure a service in the sidebar's **Model settings**, then add a project and create a session. Existing sessions keep their selected model; change it in the session header's model menu. React and CSS support hot updates; backend source changes require a restart. See the [Web README](../README.md) for installation.

## Features

| Feature | Documentation |
| --- | --- |
| Add projects, browse directories, and navigate sessions and tabs | [Projects and sessions](docs/projects.md) |
| Compose, send, cancel, and retry after failure | [Chat input](docs/chat.md) |
| Markdown, thinking, tool results, and copying | [Message rendering](docs/messages.md) |
| Custom providers and the current session's model | [Model settings](docs/models.md) |
| SSE subscriptions, snapshots, and reconnection | [Streaming state](docs/events.md) |
| Layout, language, and browser storage | [Interface preferences](docs/preferences.md) |

Each page covers one feature: usage, contracts, lifecycle, limits, and links to source and colocated tests. Components use arrow functions with matching CSS and test files. Hooks and utilities are split by responsibility.

## Validation

Run the matching tests for changed components, hooks, or utilities. For documentation-only edits, check links and content without running the full application suite. To check the entire frontend, run from the project root:

```bash
bun test src/web-ui/frontend
```

The [Web workspace](../package.json) owns dependencies and development scripts; the frontend has no separate package.json. See the [backend documentation](../backend/README.md) for service contracts.
