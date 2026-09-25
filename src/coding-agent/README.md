# Minimal Loop coding-agent

This Bun SDK and CLI uses the existing Loop Agent unchanged. Every prompt creates
a new Agent with committed history. The Agent owns all model/tool turns in that
prompt. Organization references Pi 0.87.1; installed Pi AI is 0.85.1. This is not
full Pi API or session-format compatibility.

## Start

Configure LOOP_AI_PROVIDER, LOOP_MODEL and the provider's authentication variable
(for example OPENAI_API_KEY), then run from the project root:

    bun run coding-agent
    bun run coding-agent --print 'Read package.json and explain the scripts'
    bun run coding-agent --continue
    bun run coding-agent --session /path/to/session.jsonl

New sessions default to provider openai and model gpt-5.5. Explicit configuration
and saved session selections take precedence. Without a custom URL, OpenAI uses
the native Responses API.

Set LOOP_AI_BASE_URL and LOOP_AI_API_KEY, or pass --base-url and --api-key, for an
OpenAI-compatible gateway such as Agent Maestro. The OpenAI provider then uses
Chat Completions, including models already present in the catalog. The custom URL
applies to that provider, not unrelated providers.

    LOOP_AI_BASE_URL=https://gateway.example.com/v1
    LOOP_AI_API_KEY=your-gateway-key

For Maestro without authentication, use a placeholder key such as "local-placeholder".
With authentication enabled, supply the configured key. Use the API base URL, not
the full /chat/completions route. A custom provider name can be set with LOOP_AI_PROVIDER.

Custom gateway models reuse catalog input/reasoning/context metadata when available
and cap output at 4096 tokens. Unknown models assume text input and 128K context.
These are not discovered server capabilities; zero costs are accounting placeholders.
For exact capabilities or another API, register a Provider in Pi AI createModels()
and pass createModelRuntime({ models }). Host registries retain their configured API.
Provider code is not duplicated.

Config defaults to ~/.loop, overridden by LOOP_DATA_DIR. Optional settings.json:

    {"provider":"openai","model":"gpt-5.5"}

Environment values override defaults; saved sessions retain their model selection.
Credentials are never stored in sessions. Custom endpoint configuration must be
supplied again after restart. Run --help for CLI options.

Interactive commands: /abort, /model [provider/model], /new, /resume [path], /flush,
/quit. /resume without a path lists sessions. Ctrl+C cancels a run or exits when
idle. Print outputs only the final answer. Exit codes: 0 success, 1 failure,
130 SIGINT, 143 SIGTERM. Errors go to stderr.

The loop executable and root run/chat scripts use coding-agent/cli.ts. Old
run/chat/doctor subcommands and --json/--file flags are removed. Use --print for
one-shot output and --session with a file path to restore a conversation. The SDK
contains no HTTP or browser implementation.

## SDK contracts

Import index.ts; importing it does not print, start a terminal or create files.

- createAgentSession(options): Promise<{ session: AgentSession }>
- createAgentSessionRuntime(factory, { cwd, sessionManager, model? })
- createAgentSessionServices(options): cwd, settings, resources and models
- createModelRuntime({ models?, provider?, modelId?, apiKey?, baseUrl? })
- SessionManager.create(cwd, sessionDir?): Promise<SessionManager>
- SessionManager.open(path): Promise<SessionManager>
- SessionManager.continueRecent(cwd, sessionDir?): Promise<SessionManager>
- SessionManager.inMemory(cwd?): SessionManager
- SessionManager.list(cwd, sessionDir?): Promise<SessionInfo[]>

Factory options: cwd, agentDir, model, modelRuntime, tools (names), sessionManager,
settingsManager, systemPrompt, noContextFiles, maxTurns. Unknown options reject.
ModelRuntime exposes getModel, getModels, checkModel and streamSimple; tests inject
streams through that service using real Agent. No fake extensionsResult or stable
session.agent control object is exposed.

| AgentSession API | Contract |
| --- | --- |
| prompt(text): Promise<void> | Waits for execution and saving; rejects downstream and save failures. |
| subscribe(listener) | Returns unsubscribe; async UI listeners are not awaited. |
| setModel(model): Promise<void> | Idle-only: validate auth, save selection, update model. |
| abort(): Promise<void> | Signal cancellation and wait for execution and save attempt. |
| waitForIdle(): Promise<void> | Wait for activity, swallowing its error; not a success check. |
| flush(): Promise<void> | Loop extension: retry pending history without rerunning tools/models. |
| dispose(): void | Idle-only; refuses pending history, removes listeners, prevents later use. |

Read accessors: model, sessionId, sessionFile, isRunning. state returns messages,
draft, isRunning, hasPendingSave, outcome, error, listenerErrors. Complete history
and streaming drafts are separate. Listener failures are isolated and reported
in listenerErrors. Agent's five events retain their payloads; agent_settled fires
once after execution and saving are attempted. It means stopped, not successful.

setModel rejects persist:true; edit defaults in settings.json. No thinking setter,
steering/follow-up, queues, streamingBehavior, prepareRequest, hooks, RPC, skills,
MCP or extensions are exposed. Agent's terminal/error semantics remain unchanged.

Runtime.session is current. newSession() and switchSession(path) return
Promise<{cancelled:false}>. Busy operations reject; callers can await abort first.
Target preparation failure preserves the current Session. setRebindSession(callback)
rebuilds subscriptions after replacement. New sessions preserve model/storage mode
but start empty. Switching restores cwd/model and recreates tools/resources.
Runtime.dispose() waits for cancellation and saving. Session.reserve() is internal
lifecycle coordination, not an input queue.

## Storage and failures

Loop JSONL version 1 has a loop-session metadata header followed by complete Pi AI
messages. It does not use Pi's version or tree records. Metadata includes ID,
canonical cwd, timestamps and model identity. System prompt/tools are rebuilt
from host options/resources, not appended as messages.

New persistent sessions immediately save metadata. Prompt finalization writes
one full snapshot to a temporary sibling then atomically renames it. message_end
and token events are display notifications, not durable-save signals.

On save failure the old file stays intact. state.messages retains pending history
and hasPendingSave is true. Prompts, model/session changes and disposal refuse
until flush() succeeds. AggregateError retains both execution and save failures.
Keep the Session alive, repair storage and call flush; do not rerun tools to save.

Saving happens after the entire prompt, including failure/cancellation. Forced
termination can lose the current run. No crash replay, multi-process writers,
power-loss durability or exactly-once tool execution is promised. Unsupported,
damaged files and unpaired tool histories reject. Error/aborted filtering remains
Agent/Pi AI behavior. Unknown models reject rather than silently switching.

## Tools and resources

Defaults: read, bash, edit, write. create*Tool exports use Loop's
execute(parameters, signal) and return content arrays. Validation and sequential
tool scheduling belong to Agent. read handles text and line ranges, not images.
edit accepts {path, edits:[{oldText,newText}]} with unique, disjoint exact matches
against original content. Mutations serialize by canonical path; write creates
parents. Absolute and ~/ paths are accepted: cwd is not a filesystem sandbox.

Bash limits displayed output and references a temporary full-output file when
truncated. Cancellation/timeout cleans up the process group; detached background
jobs are not supported. Retained output files can be inspected and removed by the
host. In-flight file writes may finish before observing cancellation.

Instructions load root-to-cwd, choosing AGENTS.override.md, AGENTS.md or CLAUDE.md
in that order within each directory. They are prompt text, not executable commands.
--no-context-files disables discovery. --system-prompt replaces the base prompt
while retaining cwd and discovered instructions. No Pi trust UI, worktree shadow
logic or full resource system is claimed.

## Samples and validation

Two consumer examples live beside the public entry points:

- [cli.sample.sh](cli.sample.sh) runs the CLI executable with flags and environment
  configuration. It supports interactive, Print, custom URL and session restore usage.
- [sdk.sample.ts](sdk.sample.ts) imports only the public SDK index, configures a model,
  creates a Session, subscribes to streaming events, submits a prompt and cleans up.
  It uses in-memory history so the example needs no terminal save-recovery code.

    bash src/coding-agent/cli.sample.sh
    bash src/coding-agent/cli.sample.sh --print 'Read package.json'
    bun src/coding-agent/sdk.sample.ts 'Read package.json'

Both default to OpenAI GPT-5.5 and accept LOOP_AI_BASE_URL / LOOP_AI_API_KEY for
custom gateways. CLI also accepts --base-url / --api-key. SDK consumers can use
SessionManager.create/open/continueRecent for persistence; retain the Session and
retry flush() on save failure as described above.

Validation:

    bun test src/coding-agent
    bun run typecheck
    bun run check

Samples use configured real models and can execute tools. Tests use fake streams,
local endpoints, temporary directories and real Loop Agent. Print uses a Bun
subprocess; interactive input, streaming, model/new/resume and cancellation use
a Python standard-library PTY driver. python3 is required for that test.
