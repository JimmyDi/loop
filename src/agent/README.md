# Loop Agent

An in-memory conversation loop built on Pi AI. The host supplies a model and stream function; Agent manages completed messages, sequential tools, subscriptions, and cancellation.

Import from [index.ts](index.ts). This folder belongs to the root Bun project and has no separate package installation.

## Start

See [Agent API](docs/agent.md) for a minimal call and [agent.sample.ts](agent.sample.ts) for a custom-endpoint example. Replace its example gateway URL, model ID, and capabilities, and set `AGENT_EXAMPLE_API_KEY` as needed before running it. Both examples make real model requests when configured and executed.

## Features

| Feature | Documentation |
| --- | --- |
| Create an Agent, prompt, and reuse history | [Agent API](docs/agent.md) |
| Model requests and repeated tool turns | [Agent loop](docs/agent-loop.md) |
| Streaming messages and subscriptions | [Events](docs/events.md) |
| Declare, validate, and execute tools | [Tools](docs/tools.md) |
| Abort, failure, truncation, and turn limits | [Cancellation and errors](docs/cancellation.md) |

Session storage, built-in coding tools, and model configuration belong to [coding-agent](../coding-agent/README.md). Agent has no default stream registration, persistence, queues, steering, compaction, or provider implementation.

## Validation

From the project root:

```bash
bun test src/agent
bun run typecheck
bun run check
```

These documents describe Loop's current API, which differs from Pi's full Agent API.
