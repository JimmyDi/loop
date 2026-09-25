# TypeScript SDK

The SDK embeds Loop in a Bun application. Import the public [index.ts](../index.ts); it has no terminal startup or file-creation side effects. Creating a session may load configuration and create storage.

## Minimal call

Run this TypeScript example from the project root with [model credentials](models.md) configured. It makes a real model request, disables tools, and keeps messages in memory.

```typescript
import { createAgentSession, messageText, SessionManager } from "./src/coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  tools: [],
});

try {
  await session.prompt("Hello!");
  console.log(messageText(session.state.messages.at(-1)));
} finally {
  await session.abort();
  session.dispose();
}
```

For model configuration and streaming, see the runnable [sdk.sample.ts](../sdk.sample.ts):

```bash
bun src/coding-agent/sdk.sample.ts "Hello, what time is it now?"
```

That sample enables coding tools and runs once before exiting. Without an argument it asks the model to read package.json and explain startup. Each process starts a new in-memory session; similar default answers do not indicate restored history.

## Session creation

`createAgentSession(options?): Promise<{ session: AgentSession }>` accepts:

| Option | Behavior |
| --- | --- |
| `cwd` | Workspace directory; defaults to process cwd or the supplied manager's cwd. |
| `agentDir` | Configuration/storage root; defaults to `LOOP_DATA_DIR` or `~/.loop`. |
| `modelRuntime` | Host model lookup, authentication check, and stream service. |
| `settingsManager` | Override loaded default-model settings. |
| `model` | Explicit Pi AI model, overriding a saved/default selection. |
| `tools` | Array of built-in tool names; defaults to read, bash, edit, write. Empty disables all. |
| `sessionManager` | Existing, restored, or in-memory history. Without one, create a persistent session. |
| `systemPrompt` | Replace base instructions while retaining cwd and discovered context files. |
| `noContextFiles` | Disable project instruction discovery. |
| `maxTurns` | Optional positive model-request limit per prompt, enforced by Agent. |

An explicit cwd must match the manager's canonical cwd. The factory resolves services, checks model availability/authentication, records model identity, and creates the session. Unknown options reject. `createAgentSessionServices` is also exported for hosts that only need resolved cwd, settings, model runtime, and system prompt.

## Session API

| Method | Behavior |
| --- | --- |
| `prompt(text): Promise<void>` | Complete the Agent loop and attempt history persistence. Returns no assistant value. |
| `subscribe(listener)` | Receive [session events](events.md); returns unsubscribe. |
| `abort(): Promise<void>` | Signal the run and wait for execution/save finalization. |
| `waitForIdle(): Promise<void>` | Wait without cancelling. Swallows activity failures; not a success check. |
| `setModel(model, options?: { persist?: boolean }): Promise<void>` | Change model while idle and update this session's metadata; `persist: true` rejects. |
| `flush(): Promise<void>` | Retry a pending save without rerunning the prompt. |
| `dispose(): void` | Remove listeners and forbid further use; rejects while busy or a save is pending. |

Read `model`, `sessionId`, `sessionFile`, `sessionManager`, `isRunning`, and `state`. State contains completed `messages`, optional `draft`, `isRunning`, `hasPendingSave`, `outcome`, `error`, and `listenerErrors`. Message/model snapshots can be inspected without mutating the underlying session.

Each accepted prompt creates a fresh lower-level Agent with committed history. Concurrent prompts and unsupported prompt options reject. Observe the prompt rejection and `state.outcome` to distinguish success, error, and cancellation; `abort()` resolving alone does not mean the prompt succeeded.

## Persistent hosts

Use [sessions](sessions.md) for storage and replacement through `AgentSessionRuntime`. On a failed save, retain the live session, repair storage, and call `flush()` before disposing it. The in-memory example above has no disk-save recovery requirement.

Loop does not expose `session.agent`, steering, follow-up, queues, compaction, extensions, skills, MCP, or RPC. It does not implement the complete Pi SDK.

## Source

[sdk.ts](../core/sdk.ts), [agent-session.ts](../core/agent-session.ts), [agent-session-services.ts](../core/agent-session-services.ts), and [sdk.test.ts](../core/sdk.test.ts).
