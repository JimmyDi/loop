# Coding Tools

Coding sessions enable read, bash, edit, and write by default. These local tools use the [Agent tool contract](../../../agent/src/docs/tools.md); Agent owns validation, sequential execution, and results returned to the model.

## Select tools

```bash
pnpm run coding-agent --tools read --print "Summarize package.json."
pnpm run coding-agent --tools "" --print "Explain an agent loop."
```

SDK callers use `createAgentSession({ tools: ["read"] })` or `tools: []`. Duplicate names are removed; unknown names reject. The SDK session factory accepts built-in names, not arbitrary tool objects. For lower-level Agent consumers, `createReadTool(cwd)`, `createBashTool(cwd)`, `createEditTool(cwd)`, and `createWriteTool(cwd)` are public exports.

## Tool arguments

| Tool | Parameters | Result |
| --- | --- | --- |
| `read` | Required `path`; optional positive integer `offset` and `limit`. | Text starting at a 1-based line offset. NUL-containing files reject. |
| `bash` | Required `command`; optional `timeout` in seconds, at least 0.01; optional `sandbox_permissions`: use_default or require_escalated, with nonempty `justification` required for escalation. | Combined stdout/stderr, or an error containing failure output. |
| `edit` | Required `path` and non-empty `edits: [{ oldText, newText }]`; optional `justification` (1–240 characters) for the approval explanation. | Applies unique, non-overlapping exact replacements. |
| `write` | Required `path` and `content`; optional `justification` (1–240 characters) for the approval explanation. | Creates or replaces a file, creating parent directories. |

When a write or edit needs approval, the model is instructed to supply a brief justification in the user's language. It is shown as plain text, with a policy-generated reason when omitted. It cannot change the permission preset or authorize execution; no extra model call is made to summarize it. Bash escalation already requires a justification and uses it as the approval explanation.

Every edit matches against the original file. An absent or repeated `oldText`, overlapping matches, or an empty `oldText` fails. Mutations to the same canonical path are serialized within this process, including dangling symlink aliases. A waiting approval holds that path until it settles. Operations queued behind it can cancel immediately without executing later; active mutations still finish cleanup before releasing their slot.

## Output limits

Text returned to the model is limited to 2,000 lines and about 50 KiB before annotations. Read keeps the beginning and directs the model to use offset/limit for more. Bash keeps the tail; truncated output includes a temporary full-output file path. The host can inspect and remove retained output files.

Bash has no per-call description parameter. The Web UI displays the actual command as **Bash · pnpm exec vitest run**, updating as command arguments stream in. Batch headings are composed separately by the frontend from tool names and require no model output; they remain visible below any model-authored phase update. The static tool description still documents its capability for the model.

Bash runs in the session cwd with no interactive stdin. Restricted execution uses a filtered environment and blocks networking; full access inherits the host environment. A nonzero exit or timeout becomes a tool error, which Agent passes back to the model. Without a timeout, no command duration limit is added. Sandbox preparation has its own bounded probe.

## Cancellation and access

The tools check the Agent signal. Bash terminates its process group on cancellation/timeout and escalates to SIGKILL; detached background jobs are unsupported. File writes already underway may complete before cancellation is observed and are not rolled back.

Relative paths resolve from cwd; absolute and home-relative paths are accepted subject to the effective [permission preset](permissions.md). Managed sessions and standalone mutating tool factories default to read-only. Select workspace-write explicitly to allow ordinary workspace mutations. Managed write/edit calls can request [approval](approvals.md) for one exact file change outside the preset; protected storage remains denied. Standalone factories have no session approval context. File tools use atomic regular-file replacement, preserving mode bits but not hard-link identity or extended metadata. Reads remain unconfined.

Bash applies an operating-system sandbox on macOS/Linux by default. An explicit require_escalated request asks for one unsandboxed command with host filesystem, network and environment access before dispatch. It never retries a failed command automatically. A full-access session already bypasses these restrictions. Missing or rejecting handlers, timeout and cancellation prevent dispatch. Web and interactive CLI provide approval controls; SDK hosts register a session handler and submit decisions. A model request for escalation does not itself authorize execution.

## Source

[Tool registry](../core/tools/index.ts), [read.ts](../core/tools/read.ts), [bash.ts](../core/tools/bash.ts), [edit.ts](../core/tools/edit.ts), [write.ts](../core/tools/write.ts), and [truncate.ts](../core/tools/truncate.ts). Each built-in tool has a colocated test.
