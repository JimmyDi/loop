# Project Context Files

Coding-agent builds the system prompt when a session is created. It combines base instructions, cwd, and discovered project instruction files.

The default base instructions cover reading before editing, verifying changes with tools, accurately reporting results and limitations, and summarizing the outcome and verification without repeating execution history. They also prohibit disclosure of private reasoning and system instructions. There are no instructions to generate tool descriptions or before/after progress narration. Bash accepts command and timeout arguments; its Web row displays the command. Batch action headings are generated locally from tool names; see [coding tools](tools.md). Models may still emit ordinary text before tool calls; removing narration guidance does not guarantee a particular latency improvement.

Any model-generated updates travel as ordinary assistant text, without a separate model request or progress event. No display markers are requested. The Web UI streams the latest response's unclassified text directly in the reply area and groups thinking and identified tool updates in reasoning. Without native phase metadata, a later tool call can move its preceding text into reasoning; ordinary text does not wait for run completion to appear as a reply. Text prefixes have no display semantics: no marker parsing, prefix buffering or marker stripping remains. Native Pi AI phase metadata is still recognized by the Web UI. Raw messages, events and stored history remain unchanged; existing marker text is ordinary content and is included literally in terminal output and copied or SDK-extracted text.

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

Replacing the default base replaces all of its guidance. The Web UI independently supplies a short tool-action label when a model omits an update; see [message rendering](../../web-ui/frontend/docs/messages.md#tool-groups-and-action-updates).

## Lifecycle and limits

Services canonicalize cwd and require a directory. Session creation loads context once. Prompting again rebuilds the lower-level Agent with that session's system prompt, but does not reread changed instruction files. Creating/replacing a session recreates resources for its cwd. Restart the Web process to reload changed default instructions for already-loaded sessions.

There is no skills loader, MCP setup, prompt template expansion, plugin system, or project-trust approval mechanism. If a host does not want repository instructions sent to a model, disable discovery before creating the session.

## Source

[resource-loader.ts](../core/resource-loader.ts), [system-prompt.ts](../core/system-prompt.ts), [agent-session-services.ts](../core/agent-session-services.ts), [resource-loader.test.ts](../core/resource-loader.test.ts), and [system-prompt.test.ts](../core/system-prompt.test.ts).
