# Command Line

The CLI calls the same coding-session API as SDK consumers. It provides interactive conversation and one-shot Print output.

## Run

From the project root, after [model configuration](models.md):

```bash
pnpm run coding-agent
pnpm run coding-agent --print "Read package.json and explain the scripts."
bash packages/coding-agent/src/cli.sample.sh
```

`pnpm run chat` and `pnpm run run` are aliases for the same entry point. The [CLI sample](../cli.sample.sh) preserves the caller's working directory.

## Options

| Option | Behavior |
| --- | --- |
| `--print`, `-p` | Print the final assistant text and exit. Requires a prompt. |
| `--provider NAME`, `--model ID` | Select a configured provider/model. |
| `--base-url URL`, `--api-key KEY` | Override endpoint and authentication for the selected provider. |
| `--continue`, `-c` | Continue the most recent session for the current project. |
| `--session PATH` | Open a Loop JSONL session by path. |
| `--session-dir PATH` | Override session storage/lookup directory. |
| `--no-session` | Keep history in memory only. |
| `--tools read,bash,edit,write` | Select built-in tools. `--tools ""` disables all. |
| `--permission-preset LEVEL` | Explicitly select read-only, workspace-write or danger-full-access for the startup session, including a restored session. |
| `--system-prompt TEXT` | Replace base instructions with literal text, not a file path. |
| `--no-context-files` | Disable ancestor/project instruction discovery. |
| `--help`, `-h` | Show options without starting a session. |
| `--version`, `-v` | Show the Loop version. |
| `--` | End flag parsing; remaining words become the prompt. |

`--session`, `--continue`, and `--no-session` are mutually exclusive. Unknown flags reject. Prompt arguments are joined with spaces. There is no `@file` expansion, automatic piped-input prompt, JSON mode, or RPC mode.

## Interactive commands

| Command | Behavior |
| --- | --- |
| `/abort` | Cancel the run and wait for finalization. |
| `/model` | Show the active provider/model. |
| `/model provider/id` | Switch a configured model while idle; a bare ID uses the current provider. |
| `/permissions [level]` | Show the effective preset or persist a supported preset while idle. |
| `/approve REQUEST_ID` | Allow exactly one pending operation in this session. |
| `/reject REQUEST_ID` | Reject the pending operation. |
| `/new` | Replace the current session with an empty one. |
| `/resume` | List saved session paths for the current workspace. |
| `/resume path` | Open that session and recreate its workspace services. |
| `/flush` | Retry a pending history save. |
| `/quit` | Exit; pending unsaved history blocks ordinary exit. |

Ctrl+C cancels when busy and exits when idle, unless a save is pending. There is no input queue: another ordinary prompt while busy rejects.

Startup shows the active model and permission preset. Accepted prompts show waiting feedback; model updates can show thinking or tool preparation, followed by tool status and streamed text. Complete text without deltas is rendered when the assistant ends. Thinking content itself is not printed.

## Permissions and approvals

Without an explicit flag, startup restores the saved permission preset or uses the new-session settings default (built-in: read-only). The flag applies only to the startup session: /new uses new-session defaults and /resume restores that session's saved preset. /permissions changes only the active session; it does not change global settings. Full access permits host writes and unsandboxed shell commands without individual approval.

Interactive approval requires both terminal input and output. The CLI prints the tool, reason, exact arguments and scope as escaped JSON. File requests identify the canonical path and content hashes; shell requests explicitly cover host filesystem, network, environment and descendants without a sandbox. Use the displayed request ID with /approve or /reject; a plain yes or stale ID cannot approve.

The waiting tool has no approval deadline and resumes only after an accepted decision. Rejection, /abort, Ctrl+C during a run, or shutdown settle the request without granting execution. SDK requests with an explicit timeout still report expiry. The terminal prints the outcome. Session replacement rebinds the interaction handler; decisions do not transfer to another session.

Print mode and non-terminal input do not register an approval handler. Operations requiring additional authority fail closed instead of waiting for piped input. See [permissions](permissions.md) and [approval lifecycle](approvals.md).

## Print and errors

Print mode waits for completion and outputs only the final assistant text; it is not a text-delta stream. Model and storage failures produce a nonzero exit. Normal success is 0, ordinary failure is 1, Print cancellation by SIGINT is 130, and termination by SIGTERM is 143.

A pending storage failure enters save recovery, including in Print mode: the process stays alive for `/flush` rather than discarding its only in-memory snapshot. See [sessions](sessions.md#save-failure).

## Source

[cli.ts](../cli.ts), [args.ts](../cli/args.ts), [main.ts](../main.ts), [interactive mode](../modes/interactive/interactive-mode.ts), and [CLI tests](../main.test.ts).
