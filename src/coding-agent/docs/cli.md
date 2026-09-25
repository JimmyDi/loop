# Command Line

The CLI calls the same coding-session API as SDK consumers. It provides interactive conversation and one-shot Print output.

## Run

From the project root, after [model configuration](models.md):

```bash
bun run coding-agent
bun run coding-agent --print "Read package.json and explain the scripts."
bash src/coding-agent/cli.sample.sh
```

`bun run chat` and `bun run run` are aliases for the same entry point. The [CLI sample](../cli.sample.sh) preserves the caller's working directory.

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
| `/new` | Replace the current session with an empty one. |
| `/resume` | List saved session paths for the current workspace. |
| `/resume path` | Open that session and recreate its workspace services. |
| `/flush` | Retry a pending history save. |
| `/quit` | Exit; pending unsaved history blocks ordinary exit. |

Ctrl+C cancels when busy and exits when idle, unless a save is pending. There is no input queue: another ordinary prompt while busy rejects.

Startup shows the active model. Accepted prompts show waiting feedback; model updates can show thinking or tool preparation, followed by tool status and streamed text. Complete text without deltas is rendered when the assistant ends. Thinking content itself is not printed.

## Print and errors

Print mode waits for completion and outputs only the final assistant text; it is not a text-delta stream. Model and storage failures produce a nonzero exit. Normal success is 0, ordinary failure is 1, Print cancellation by SIGINT is 130, and termination by SIGTERM is 143.

A pending storage failure enters save recovery, including in Print mode: the process stays alive for `/flush` rather than discarding its only in-memory snapshot. See [sessions](sessions.md#save-failure).

## Source

[cli.ts](../cli.ts), [args.ts](../cli/args.ts), [main.ts](../main.ts), [interactive mode](../modes/interactive/interactive-mode.ts), and [CLI tests](../main.test.ts).
