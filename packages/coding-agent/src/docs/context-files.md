# Project Context Files

Coding-agent assembles base instructions, cwd, and discovered project instruction files when a session is created. Each user prompt appends current tool and Skill summaries. Permission changes do not alter these system instructions; dynamic permission guidance travels separately as [runtime context](runtime-context.md). Tool checks and the native sandbox enforce the policy.

## Prompt structure

The builder keeps the preamble, default rules, cwd and project instruction files in separate internal sections before rendering the model-facing string. The preamble remains plain text. Default behavior rules use `<rules>`, the working directory uses `<cwd>`, and discovered files use `<project_context>` with one `<project_instructions path="...">` block per file. Project files retain their discovery order. Empty project context is omitted.

For example, a custom base and one discovered file produce:

```xml
Custom base instructions

<cwd>
project
</cwd>

<project_context>
<project_instructions path="AGENTS.md">
Read relevant files before editing.
</project_instructions>
</project_context>
```

Cwd and wrapped instruction text escape `&`, `<` and `>` while keeping single and double quotes literal. Source-path attribute values also escape quotes so they cannot end the attribute. Embedded tags cannot break the generated block boundaries. Custom base text remains literal, including an explicitly empty base. Source files are never rewritten. The model receives a string containing these tags, not a separate XML API payload. Tags identify content and sources; they are not a parser, a trust check or a permission boundary.

Before each user prompt, the session appends `<tools>` with a compact JSON array of canonical direct-call names copied from the current declarations. This text gives the model a literal naming reference; it contains no descriptions, schemas or separately computed count. Empty registries render `[]`. Full descriptions and parameter schemas remain exclusively in the model request's separate `tools` field. Both views use the same captured registry, including `load_skill` and, when MCP tools are ready, `codemode`. Declared names are preserved and XML-escaped.

The separate `<tool_usage>` section contains rules only. The request's tool declarations are authoritative for availability reports and exact dispatch names. The rules require literal `tools[].name` values in both user-facing replies and direct calls, without adding or removing namespaces such as `functions.`; prefixes already present in a declared name remain intact. Provider presentation and earlier replies do not rename tools. The rules tell the model to list only the current declarations and not infer availability from older messages or assumed wrappers. When `multi_tool_use.parallel` is absent from the registry, a targeted rule still identifies it as unavailable, including when older assistant replies claimed otherwise. Unavailable tools are omitted from ordinary lists unless the user asks about them.

Usage rules state that tool calls execute sequentially and provide no implicit parallel dispatch wrapper. When `codemode` is declared, they also direct MCP discovery through it and explain that nested calls remain sequential even with `Promise.all`. Without that entry, the generated rules do not suggest using it. Rules are rebuilt for each prompt, including custom base prompts, without rewriting conversation history or filtering response text. They do not grant permission; unknown calls are independently rejected by the executor. Adding ordinary tools lengthens only the name array, without duplicating descriptions or schemas; both the array and full declarations count toward the context budget. Prompt guidance cannot guarantee literal names in every generated reply.

Ready MCP services with callable tools appear separately in `<mcp_servers>`, with their ID, display name and codemode access. If initialization returned server instructions, the first nonempty line supplies a summary of at most 160 Unicode characters plus an ellipsis. Without instructions, only the service identity and access information are included. Commands, URLs, environment variables and authentication settings are not used to build the summary. MCP tools and their schemas are absent from initial declarations. The model discovers names and descriptions through `searchTools` or `describeNamespace` inside `codemode`, requests selected schemas with `describeTool`, and calls tools from isolated scripts. Only emitted output and compact call statuses enter model context; complete nested responses stay inside the script unless emitted. Connecting, failed, disabled and zero-tool servers are omitted; discovery is not awaited. See [Codemode](codemode.md).

When a Skill manager is configured, `<skills>` contains usage rules and a bounded catalog of enabled, valid, automatically invocable Skills. Entries include the exact loading handle, name, Personal/Project scope and description. Full instructions enter [runtime context](runtime-context.md) for explicit selections or ordinary `load_skill` results for automatic loads. The current system catalog governs new loads; old catalogs in restored history may be stale. Existing stored snapshots are preserved. Empty catalogs explicitly report current availability.

Capability sections escape wrapped text and are rebuilt from the current manager views for each user prompt. Tool continuations reuse the same sections and tool snapshot. Connecting, disabling or refreshing MCPs and refreshing or disabling Skills affects the next user prompt; live tool enforcement can still reject an invalidated call. The complete rendered string, including summaries, tags and escaping, participates in the [context budget](context-budget.md). Capability changes can change the system-prompt prefix and affect provider caching. This implementation does not persist section patches or update sections during a run.

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

Services canonicalize cwd and require a directory. Session creation loads project context once. Prompting again rebuilds the lower-level Agent using cached base/project instructions and fresh capability summaries, without rereading changed instruction files. Runtime context records the initial permission policy and later changes after retained history, without changing earlier request content. Creating/replacing a session recreates resources for its cwd. Restart the Web process to reload changed default instructions for already-loaded sessions.

There is no prompt template expansion, plugin system, or project-trust approval mechanism. [Skills](skills.md) and [MCP servers](mcp.md) are managed separately from instruction discovery. If a host does not want repository instructions sent to a model, disable discovery before creating the session.

## Source

[resource-loader.ts](../core/resource-loader.ts), [system-prompt.ts](../core/system-prompt.ts), [capability-prompt.ts](../core/capability-prompt.ts), [agent-session-services.ts](../core/agent-session-services.ts), [resource-loader.test.ts](../core/resource-loader.test.ts), [system-prompt.test.ts](../core/system-prompt.test.ts), and [capability-prompt.test.ts](../core/capability-prompt.test.ts).
