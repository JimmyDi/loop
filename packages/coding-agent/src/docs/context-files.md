# Project Context Files

Coding-agent assembles base instructions, cwd, and discovered project instruction files when a session is created. This system prompt stays unchanged when permissions change. Dynamic permission guidance travels separately as [runtime context](runtime-context.md); tool checks and the native sandbox enforce the policy.

The default base instructions cover reading before editing, verifying changes with tools, accurately reporting results and limitations, and summarizing the outcome and verification without repeating execution history. They also prohibit disclosure of private reasoning and system instructions.

Before every tool batch, the model is instructed to output a nonempty plan as ordinary assistant text in the user's language, before the first tool call in the same response. One or two sentences summarize what the whole batch will do and why; the plan covers that batch only. After results return, every further tool-calling response must include a new plan for its own batch, including continued work, retries and verification, using relevant observed results to explain the next step. Plans must not appear only in thinking or tool arguments, and must not claim success before tool results confirm it. This is prompt guidance, not a runtime guarantee: nonconforming tool-only responses are still executed without synthesized text or extra model requests. Existing saved responses are not rewritten. A plain text response without tool calls still ends the minimal Agent loop; the prompt therefore prohibits standalone plan responses without their intended calls.

Phase updates travel as ordinary assistant text through native `text_delta`, without a separate model request, progress event or tool parameter. The Web UI lays out updates, tool calls and final replies in history order, with text appearing immediately and staying in place when later calls arrive. Thinking is hidden only from the Web conversation; original messages, events, model replay and SDK history are preserved. Bash rows display the actual command, and batch action summaries are generated locally from tool names; see [coding tools](tools.md) and [message rendering](../../../web-ui/src/frontend/docs/messages.md#tool-groups-and-action-updates).

No display markers are requested. Text prefixes have no display semantics: they are not parsed, buffered, stripped or trimmed. Native model-response phase metadata remains intact and is not needed to order the conversation. Existing marker text remains ordinary content and is included literally in terminal output and copied or SDK-extracted text.

## Discovery order

For each directory from the filesystem root down to the session cwd, load the first existing file from this priority list:

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Only one file per directory is included, with ancestors before descendants. Files under child directories are not discovered by this walk. Instructions are plain prompt text, not executable modules or a hard permission boundary.

## Configuration

Disable discovery for the CLI:

```bash
pnpm run coding-agent --no-context-files --print "Hello!"
```

Or pass `noContextFiles: true` to `createAgentSession`. This still includes base instructions and cwd.

`--system-prompt TEXT` or the SDK's `systemPrompt` replaces the default base text. It does not suppress cwd or discovered instruction files. CLI input is literal text, not a filename to load.

Replacing the default base replaces all of its guidance. The Web UI independently supplies a short tool-action summary for each batch, including when a model omits an update; see [message rendering](../../../web-ui/src/frontend/docs/messages.md#tool-groups-and-action-updates).

## Lifecycle and limits

Services canonicalize cwd and require a directory. Session creation loads context once. Prompting again rebuilds the lower-level Agent using the cached system prompt, without rereading changed instruction files. Runtime context records the initial permission policy and later changes after retained history, without changing earlier request content. Creating/replacing a session recreates resources for its cwd. Restart the Web process to reload changed default instructions for already-loaded sessions.

There is no skills loader, prompt template expansion, plugin system, or project-trust approval mechanism. [MCP servers](mcp.md) are managed separately from instruction discovery. If a host does not want repository instructions sent to a model, disable discovery before creating the session.

## Source

[resource-loader.ts](../core/resource-loader.ts), [system-prompt.ts](../core/system-prompt.ts), [agent-session-services.ts](../core/agent-session-services.ts), [resource-loader.test.ts](../core/resource-loader.test.ts), and [system-prompt.test.ts](../core/system-prompt.test.ts).
