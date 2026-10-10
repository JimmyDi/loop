# TypeScript SDK

The SDK embeds Loop in a Node.js 24+ application. Installed consumers import from `@loop-harness/loop`; the examples below use the private workspace package @loop/coding-agent for repository development. Import the public [index.ts](../index.ts); it has no terminal startup or file-creation side effects. Creating a session may load configuration and create storage.

## Minimal call

Run this TypeScript example from the project root with [model credentials](models.md) configured. It makes a real model request, disables built-in tools, and keeps messages in memory.

```typescript
import { createAgentSession, messageText, SessionManager } from "@loop/coding-agent";

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
node --conditions=loop-source --import tsx packages/coding-agent/src/sdk.sample.ts "Hello, what time is it now?"
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
| `model` | Explicit model configuration, overriding a saved/default selection. |
| `tools` | Array of built-in tool names; defaults to read, bash, edit, write. Empty disables built-ins. |
| `mcpManager` | Optional shared MCP manager; snapshots its ready tools at each prompt. The host owns cleanup. |
| `skillManager` | Optional shared skill manager owned by the host; otherwise the SDK creates one. See [skills](skills.md). |
| permissionPreset | Trusted-host choice of read-only, workspace-write or danger-full-access. Overrides saved/default selection; see [permissions](permissions.md). |
| `sessionManager` | Existing, restored, or in-memory history. Without one, create a persistent session. |
| `systemPrompt` | Replace base instructions while retaining cwd and discovered context files. |
| `noContextFiles` | Disable project instruction discovery. |
| `effort` | Optional model reasoning effort; validated against supported levels. Saved in session model metadata. Missing values restore the saved effort or use default. |
| `maxTurns` | Optional positive model-request limit per prompt, enforced by Agent. |
| `maxTokens` | Optional positive safe integer caller output cap for every main request, bounded by the selected model ceiling. Native fixed-thinking adjustments are included in the context reserve. Session-local; not persisted. See [context budget](context-budget.md). |
| `title` | Optional [title policy](session-titles.md): mode, model override, input/output limits and timeout. SDK defaults to deterministic fallback only. |
| `allowUnavailableModel` | Opt-in restoration of saved history without requiring its model/authentication during creation. Defaults to false; prompt and model-switch preflight remain mandatory. |

An explicit cwd must match the manager's canonical cwd. The factory resolves services, checks model availability/authentication, records model identity, and creates the session. Unknown options reject. `createAgentSessionServices` is also exported for hosts that only need resolved cwd, settings, model runtime, and system prompt.

## Session API

| Method | Behavior |
| --- | --- |
| `prompt(content: PromptContent, options?: { skills?: string[] }): Promise<void>` | Complete the Agent loop and attempt history persistence, optionally loading exact skill identities. Returns no assistant value. |
| `validateSkillSelection(ids, signal?): Promise<void>` | Validate explicit selections without making a model request. |
| `subscribe(listener)` | Receive [session events](events.md); returns unsubscribe. |
| `abort(): Promise<void>` | Signal the run and wait for execution/save finalization. |
| `waitForIdle(): Promise<void>` | Wait without cancelling. Swallows activity failures; not a success check. |
| `renameTitle(text): Promise<void>` | Save a manual title and pin it against automatic updates. Requires idle state. |
| `refreshTitle(): Promise<void>` | Explicitly regenerate from saved user messages; success removes a manual pin. Requires idle state. |
| `waitForTitle(): Promise<void>` | Drain current background title work and storage writes without cancelling. |
| `cancelTitle(): Promise<void>` | Cancel and drain title work without stopping the main prompt. |
| `setModel(model, options?: { persist?: boolean; effort?: ModelEffort }): Promise<void>` | Change model/effort while idle and update this session's metadata; `persist: true` rejects. |
| `flush(): Promise<void>` | Retry a pending save without rerunning the prompt. |
| setPermissionPreset(preset): Promise<void> | Persist a managed session's preset while idle, then emit permission_changed. Rejects with pending approvals. |
| `requestApproval(input, options?): Promise<ApprovalResult>` | Create a bounded host approval request; does not execute or escalate built-in tools. |
| `registerApprovalHandler(handler): () => void` | Register one interaction handler; detaching settles its pending requests as unavailable. |
| `respondToApproval(response): boolean` | Submit allowed-once or rejected for matching session/request IDs; eligible MCP requests also accept allowed-session. |
| `dispose(): void` | Cancel idle approval requests, remove listeners and forbid further use; rejects while busy or a save is pending. |

Read `model`, `effort`, `sessionId`, `sessionFile`, `sessionManager`, `isRunning`, and `state`. State contains completed `messages`, optional `draft`, `isRunning`, `hasPendingSave`, `outcome`, `error`, and `listenerErrors`. Message/model snapshots can be inspected without mutating the underlying session. `modelInputProjection` returns the latest dispatched main request's source map without message bodies; see [model input projection](model-input-projection.md). The optional `state.contextBudget` and `context_budget` event expose the latest full-request estimate. `prompt()` can reject with exported `ContextBudgetExceededError` before model dispatch; complete history is retained. Actual provider usage remains in completed assistant messages. See [context budget](context-budget.md) for recovery and estimation limits.

Managed sessions additionally expose permissionPreset directly and in state. Direct AgentSession construction with custom host tools has no managed preset and rejects permission changes. The managed factory's version-2 session metadata requires a current Loop reader.

Session snapshots include pendingApprovals, separate from model-running status and saved history. Pending requests block new prompts, metadata changes and runtime replacement. Abort cancels approval waits, and run finalization drains outstanding requests. See [approvals](approvals.md) for the interaction contract and built-in tool integration limits.

Managed tools now issue approval requests before operations requiring additional authority. Register a handler before prompting and inspect request.operation for the validated arguments and scope. A matching allowed-once response resumes the waiting tool only; a standalone requestApproval call does not execute a tool. File approvals bind one replacement, while explicit Bash escalation grants one unsandboxed invocation with host filesystem/network/environment access. Both preserve the session preset.

PromptContent is a string or text/image blocks. Image-only messages are supported, with base64 image data and MIME type stored in session history. The selected model must allow image input. Existing string calls remain valid.

Each accepted prompt creates a fresh lower-level Agent with committed history. Concurrent prompts and unsupported prompt options reject. Observe the prompt rejection and `state.outcome` to distinguish success, error, and cancellation; `abort()` resolving alone does not mean the prompt succeeded.

The public messageText helper concatenates text blocks in order, excludes thinking and tool calls, and returns an empty string for an absent message. It preserves text literally, including any prefixes in older history; it performs no display-marker filtering.

## Persistent hosts

Use [sessions](sessions.md) for storage and replacement through `AgentSessionRuntime`. On a failed save, retain the live session, repair storage, and call `flush()` before disposing it. The in-memory example above has no disk-save recovery requirement.

Hosts can supply a shared `mcpManager` to add ready external tools to each prompt; see [MCP servers](mcp.md) for lifecycle, session permission enforcement and memory-only session tool grants. [Skills](skills.md) add workflows through background metadata discovery and on-demand loading. `session.compact()` creates a durable summary checkpoint without replacing original history; automatic compaction runs before main requests under input pressure with no additional configuration. See [compaction](compaction.md) for thresholds, events and recovery. Loop does not expose `session.agent`, steering, follow-up, queues, extensions, or RPC.

## Source

[sdk.ts](../core/sdk.ts), [agent-session.ts](../core/agent-session.ts), [agent-session-services.ts](../core/agent-session-services.ts), and [sdk.test.ts](../core/sdk.test.ts).
