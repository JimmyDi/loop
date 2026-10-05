# Loop Agent

An in-memory conversation loop for Loop. The host supplies a model and stream function; Agent manages completed messages, sequential tools, subscriptions, and cancellation.

Import from [index.ts](src/index.ts). This private workspace package declares its own dependencies and public exports. It is bundled into the root loop distribution.

## Start

See [Agent API](src/docs/agent.md) for a minimal call and [agent.sample.ts](src/agent.sample.ts) for a custom-endpoint example. Replace its example gateway URL, model ID, and capabilities, and set `AGENT_EXAMPLE_API_KEY` as needed before running it. The sample makes real model requests when configured and executed.

## Features

| Feature | Documentation |
| --- | --- |
| Create an Agent, prompt, and reuse history | [Agent API](src/docs/agent.md) |
| Model requests and repeated tool turns | [Agent loop](src/docs/agent-loop.md) |
| Streaming messages and subscriptions | [Events](src/docs/events.md) |
| Declare, validate, and execute tools | [Tools](src/docs/tools.md) |
| Abort, failure, truncation, and turn limits | [Cancellation and errors](src/docs/cancellation.md) |

Session storage, built-in coding tools, and model configuration belong to [coding-agent](../coding-agent/README.md). Agent has no default stream registration, persistence, queues, steering, compaction, or provider implementation.

## Validation

From the project root:

```bash
pnpm exec vitest run packages/agent/src
pnpm run typecheck
pnpm run check
```

These documents describe Loop's implemented API and its limits.
