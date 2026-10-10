# Runtime Context

Application instructions remain separate from original conversation. Current permission guidance is rendered in the system prompt; explicitly selected Skill instructions are expanded into their matching model-facing user message. Enforcement remains independent of prompt text.

## Usage and assembly

Use the permission picker or `session.setPermissionPreset()` while idle. The next prompt refreshes `<permissions>`. Multiple switches before submitting use the final selection. The installed model runtime receives an ordinary `systemPrompt` string, not native system transcript messages.

Explicit selection through Web, `$name` or `prompt(content, { skills: [id] })` reads instructions and saves their revision. Projection prepends `<skill name="..." location="...">` blocks to the corresponding user message. String input stays a string; block input receives a text block before existing text and images. Stored input, attachments, events and title inputs remain unchanged. Automatic loads remain ordinary `load_skill` results. Skills do not grant tool permission.

## Storage and lifecycle

`RuntimeContextSnapshot` has `userTurn`, `content`, `timestamp`, optional `skills`, and optional `placement: "user"`. New explicit selections use this placement; permission changes no longer create snapshots. The anchor is the zero-based ordinal among actual user messages. Repeated selections preserve independent revisions. `getRuntimeContexts()` returns isolated committed or pending state.

Version-2 snapshots without placement replay as separate user messages at their original anchors and are not rewritten. Current system permissions supersede earlier guidance. Stored instructions remain available after reopening even if their source changes.

`SystemPromptCheckpoint` stores `messageCount`, `timestamp` and changed rendered `sections` in the header. The first dispatched prompt records all sections; later prompts record changes and `null` removals. `getSystemPromptCheckpoints()` returns isolated metadata. These are not sent as user text and do not guarantee incremental transmission or cache hits. Project instruction files are loaded at session creation.

Only dispatched requests accept new Skill and system checkpoints. Preflight or budget rejection does not. Metadata and conversation commit together; failed writes retain pending state for `flush()` without repeating tools or model calls. Unsaved state cannot survive process termination.

## Presentation and limits

Runtime metadata stays out of `state.messages`, conversation counts and title generation. [Projection](model-input-projection.md) maps originals, legacy context, Skills and [summaries](compaction.md). Mappings are not forwarded to the provider. Full budgeting includes all instructions and declarations. Tags are not a parser or security boundary.

## Source

[Snapshots](../core/runtime-context.ts), [Skill rendering](../core/skills/skill-file.ts), [projection](../core/model-input-projection.ts), [prompt checkpoints](../core/context/system-prompt-state.ts), [permissions](../core/permissions/permission-context.ts), [lifecycle](../core/agent-session.ts), [storage](../core/session-manager.ts).
