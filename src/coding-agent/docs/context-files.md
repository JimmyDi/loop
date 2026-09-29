# Project Context Files

Coding-agent builds the system prompt when a session is created. It combines base instructions, cwd, and discovered project instruction files.

The default base instructions ask the model for a concise, visible update before each tool batch, in the user's language. Later updates describe verified results and the next action; the final answer avoids repeating progress. These updates describe actions, not private chain-of-thought. The prompt requests a leading `<!-- loop:commentary -->` marker on action updates and `<!-- loop:final -->` on answers, including direct answers. They travel as ordinary assistant text, without a separate model request or progress event. The Web UI uses the prefix to stream each block into its intended area; terminal output and the SDK messageText helper omit leading markers. Raw Pi AI messages, events and saved history retain them. Markers are display hints and never authorize tool execution. Model compliance can vary; unmarked text uses the Web fallback.

## Discovery order

For each directory from the filesystem root down to the session cwd, load the first existing file from this priority list:

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Only one file per directory is included, with ancestors before descendants. Files under child directories are not discovered by this walk. Instructions are plain prompt text, not executable modules or a hard permission boundary.

## Configuration

Disable discovery for the CLI:

```bash
bun run coding-agent --no-context-files --print "Hello!"
```

Or pass `noContextFiles: true` to `createAgentSession`. This still includes base instructions and cwd.

`--system-prompt TEXT` or the SDK's `systemPrompt` replaces the default base text. It does not suppress cwd or discovered instruction files. CLI input is literal text, not a filename to load.

Replacing the default base also replaces its progress-update instructions. The Web UI still supplies a short tool-action label when a model omits an update; see [message rendering](../../web-ui/frontend/docs/messages.md#tool-groups-and-action-updates).

## Lifecycle and limits

Services canonicalize cwd and require a directory. Session creation loads context once. Prompting again rebuilds the lower-level Agent with that session's system prompt, but does not reread changed instruction files. Creating/replacing a session recreates resources for its cwd. Restart the Web process to reload changed default instructions for already-loaded sessions.

There is no skills loader, MCP setup, prompt template expansion, plugin system, or project-trust approval mechanism. If a host does not want repository instructions sent to a model, disable discovery before creating the session.

## Source

[resource-loader.ts](../core/resource-loader.ts), [system-prompt.ts](../core/system-prompt.ts), [agent-session-services.ts](../core/agent-session-services.ts), [resource-loader.test.ts](../core/resource-loader.test.ts), and [system-prompt.test.ts](../core/system-prompt.test.ts).
