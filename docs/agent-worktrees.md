# Coding-agent worktrees

Start a terminal-based coding agent through the launcher from the repository root. It runs on Node.js 24+ and Git and needs no installed workspace dependencies.

```bash
node scripts/agent-worktree.mjs codex
node scripts/agent-worktree.mjs claude
```

Use the executable for your client, followed by its usual arguments. Launchers for different clients share the same checkout registrations. Use an executable on PATH or an absolute executable path. Leave out client options that override the working directory.

The launcher registers the session in the checkout's Git metadata before checking for competing registrations. A live launcher in the **same checkout**, or any staged, unstaged, or untracked changes there, causes the launcher to create a sibling worktree at the current commit and start the agent there. A clean, unoccupied checkout is used directly. Registrations are released on exit, and entries for dead processes are ignored. Git ignores ignored files. Status detects changes without identifying their author. Other sessions that bypass the launcher are visible through Git changes once they write. A worktree used by another task elsewhere in the repository is already isolated.

The launcher prints the location of each worktree it creates. It uses a detached `HEAD` and leaves the worktree on disk for review or reuse. Uncommitted files and ignored files such as installed dependencies or local configuration stay in the original checkout. If worktree creation fails, the agent does not start. If you have finished reviewing an unused worktree, remove it with `git worktree remove <path>`. Git refuses ordinary removal when the worktree still contains local changes.

## GUI and editor sessions

Use Worktree mode when starting an editing task in Codex desktop. For an existing session, use its managed worktree action when available, or open the isolated checkout in the editor and start the task there. Clients without a worktree picker can open a directory prepared with `git worktree add --detach <unused-path> HEAD`. Continue any work that depends on uncommitted files in its assigned checkout.

The repository's [Codex hook](../.codex/hooks.json) and [Claude Code hook](../.claude/settings.json) check the starting checkout on startup and resume. They give the agent guidance if they detect a conflict. The hooks run inside an existing session and cannot change its working root. Review the Codex hook via `/hooks` in a trusted project, and trust the Claude Code project before loading its hooks. Codex and clients that support `AGENTS.md` read the [shared instructions](../AGENTS.md). Claude Code imports them through [CLAUDE.md](../CLAUDE.md).
