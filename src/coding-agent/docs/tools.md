# Coding Tools

Coding sessions enable read, bash, edit, and write by default. These local tools use the [Agent tool contract](../../agent/docs/tools.md); Agent owns validation, sequential execution, and results returned to the model.

## Select tools

```bash
bun run coding-agent --tools read --print "Summarize package.json."
bun run coding-agent --tools "" --print "Explain an agent loop."
```

SDK callers use `createAgentSession({ tools: ["read"] })` or `tools: []`. Duplicate names are removed; unknown names reject. The SDK session factory accepts built-in names, not arbitrary tool objects. For lower-level Agent consumers, `createReadTool(cwd)`, `createBashTool(cwd)`, `createEditTool(cwd)`, and `createWriteTool(cwd)` are public exports.

## Tool arguments

| Tool | Parameters | Result |
| --- | --- | --- |
| `read` | Required `path`; optional positive integer `offset` and `limit`. | Text starting at a 1-based line offset. NUL-containing files reject. |
| `bash` | Required `command`; optional `timeout` in seconds, at least 0.01. | Combined stdout/stderr, or an error containing failure output. |
| `edit` | Required `path` and non-empty `edits: [{ oldText, newText }]`. | Applies unique, non-overlapping exact replacements. |
| `write` | Required `path` and `content`. | Creates or replaces a file, creating parent directories. |

Every edit matches against the original file. An absent or repeated `oldText`, overlapping matches, or an empty `oldText` fails. Mutations to the same canonical path are serialized within this process.

## Output limits

Text returned to the model is limited to 2,000 lines and about 50 KiB before annotations. Read keeps the beginning and directs the model to use offset/limit for more. Bash keeps the tail; truncated output includes a temporary full-output file path. The host can inspect and remove retained output files.

Bash uses `bash -c` in the session cwd with no interactive stdin. It inherits the process environment. A nonzero exit or timeout becomes a tool error, which Agent passes back to the model. Without `timeout`, no duration limit is added by this tool.

## Cancellation and access

The tools check the Agent signal. Bash terminates its process group on cancellation/timeout and escalates to SIGKILL; detached background jobs are unsupported. File writes already underway may complete before cancellation is observed and are not rolled back.

Relative paths resolve from cwd; absolute and `~/` paths are accepted. Cwd is not a sandbox. Tools run with the host process's filesystem and command permissions. No approval UI or permission policy is applied by these minimal tools.

## Source

[Tool registry](../core/tools/index.ts), [read.ts](../core/tools/read.ts), [bash.ts](../core/tools/bash.ts), [edit.ts](../core/tools/edit.ts), [write.ts](../core/tools/write.ts), and [truncate.ts](../core/tools/truncate.ts). Each built-in tool has a colocated test.
