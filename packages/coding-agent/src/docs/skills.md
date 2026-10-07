# Skills

Skills are directories containing a `SKILL.md` workflow and optional references, scripts and assets. Loop discovers their metadata in the background and loads instructions only when selected or requested by the model. Installing a skill never executes its scripts or installs its dependencies.

## Minimal usage

Create `.agents/skills/review-source/SKILL.md` in the workspace:

```markdown
---
name: review-source
description: Review source changes for correctness and missing validation.
---
Read the relevant implementation and its tests. Explain concrete findings.
Resolve references relative to this directory.
```

In Web, open Settings → Integrations → Skills, refresh if needed, and choose Use in chat. Alternatively type `$` at the end of the composer to select a skill. In CLI or SDK text, `$review-source` explicitly selects a discovered skill with that unique name. Duplicate names require an exact selection; SDK hosts can supply identities.

```typescript
import { SkillManager } from "@loop/coding-agent";

const manager = new SkillManager("./loop-data");
try {
  await manager.refresh(process.cwd());
  const catalog = manager.view(process.cwd());
  console.log(catalog.skills.map(({ id, name }) => ({ id, name })));
} finally {
  await manager.close();
}
```

## Discovery and storage

| Location | Scope and ownership |
| --- | --- |
| `<agentDir>/skills/<name>/SKILL.md` | Personal, installed by Loop |
| `~/.agents/skills/<folder>/SKILL.md` | Personal, managed externally |
| `<workspace>/.agents/skills/<folder>/SKILL.md` | Project |
| Ancestor `.agents/skills` up to and including the repository root | Project, available to nested workspaces |
| `<agentDir>/skills.json` | Versioned installation provenance and disabled identities |

`agentDir` defaults to `LOOP_DATA_DIR` or `~/.loop`. Without a repository marker, only the selected workspace contributes project skills. The personal-only management view does not require an existing agent directory. Discovery checks immediate child directories, follows discovery symlinks, deduplicates canonical source paths, and retains distinct same-name sources. Hidden installation staging directories are ignored.

`view(cwd)` returns a cloned `SkillCatalog` immediately and starts a scan when needed. Active catalogs are rescanned every three seconds. `refresh(cwd)` awaits a scan. Invalid metadata appears as an unavailable row; a root/settings read failure retains the last catalog with an error. Startup never downloads remote skills.

## Metadata and API

YAML frontmatter requires `name` (lowercase letters, numbers and hyphens, at most 64 characters) and a nonempty `description` (at most 1024 characters). The body must be nonempty UTF-8 text, with the whole main file at most 128 KiB. Duplicate YAML keys reject. Optional boolean `disable-model-invocation: true` hides the skill from automatic selection but permits explicit selection.

Each summary has an exact source-derived `id`, a unique model `handle`, name, description, canonical main-file path, scope, enabled state, model invocation policy, managed state and provenance. Disabling is keyed by identity, so same-name sources remain independent.

`createAgentSession({ skillManager })` accepts an optional shared manager owned by the host. Otherwise the SDK creates and disposes its own manager. The session exposes:

- `prompt(content, { skills: [id] })`: select at most eight exact identities. Matching `$name` text also selects skills.
- `validateSkillSelection(ids, signal?)`: read and validate selections without dispatching a model call.
- `skills_loaded` events and `state.skillLoads`: explicit loaded snapshots anchored by zero-based user-turn ordinal.

The common model tool `load_skill({ handle })` loads an enabled, model-invocable skill. Loading rechecks settings, canonical path and metadata, then reads the current instructions and computes their SHA-256 revision. Disabled, missing or changed sources reject. Usage rules and a bounded metadata catalog enter the system prompt's `<skills>` section. Each entry includes the exact loading handle, name, scope and description, without the full instruction body. The catalog is rebuilt from the current manager view before each user prompt, without awaiting discovery, and remains unchanged during tool continuations. New loads use this catalog even if restored history contains older catalogs.

The automatic metadata catalog targets two percent of the model context window, clamped to a 64-to-2000-token allowance; escaped metadata and its XML wrapper count toward that allowance, while fixed usage rules are counted by the complete request budget. Excess entries are omitted with a count. Explicit loading remains possible. Every full request, including summaries and loaded bodies, passes the existing context-budget check.

Loaded snapshots include an optional description captured from the current metadata for host display. Existing snapshots without it remain valid. Explicit instructions and their revisions are saved in `runtimeContexts[].skills`; automatic loads remain ordinary tool results with the loaded body and revision. Restoring history reuses those exact texts rather than rereading updated sources. Disabling a skill prevents new loads; it does not erase instructions already present in history.

## Installation and management

`manager.installer.preview(input)` creates an asynchronous `SkillJob`. Supported kinds are `github`, `local` and `created`. Poll `installer.get(id)`; `cancel(id)` aborts pending work. Ready previews expose candidate metadata, instructions and included file names. Jobs expire after ten minutes, with at most eight active previews.

`manager.install(cwd, jobId, keys, scope, updateId?)` copies selected candidates into the personal root or workspace `.agents/skills`. GitHub sources use public `https://github.com` repository/folder URLs and an optional ref. Loop resolves an immutable commit and downloads the complete selected directories through the GitHub API. Local sources refer to the machine running Loop. Created sources supply complete Markdown content.

Bundles reject traversal, symlinks and special files. Each folder has at most 500 files; downloads are bounded to 20 MiB, previews to 30 candidates, and local nesting to 12 levels. Local `.git`, `node_modules` and `.DS_Store` are excluded. Executable file permission is preserved; no code is run during preview or install. Existing folders are never replaced by a new installation.

`previewUpdate(cwd, id)` prepares a new preview for a managed GitHub installation. Installing that preview with `updateId` replaces only the same named directory. Installation uses staging and rollback if copying or metadata persistence fails. Mutation operations are serialized within one manager. Updates require explicit action; there is no automatic update.

`toggle(cwd, id, enabled)` persists availability. `detail(cwd, id)` reads the current body. `remove(cwd, id)` removes only a tracked installation in an owned installation root; externally discovered skills can be disabled but cannot be deleted through this API. `close()` stops scans, cancels previews and drains mutations.

## Permissions and limitations

Skill instructions never grant authority. References use existing read tools and scripts use the existing shell tool with session permissions. Installation is a host management operation initiated by the user, not a model tool. Private GitHub repositories, authentication, dependency installation, remote registries, edit-in-place UI and automatic updates are not implemented. Downloads can encounter GitHub rate limits; adding a local folder is an alternative. Script compatibility depends on the host environment. Separate processes do not coordinate installation writes.

## Source and tests

[Manager](../core/skills/skill-manager.ts), [discovery](../core/skills/discovery.ts), [metadata parser](../core/skills/skill-file.ts), [installer](../core/skills/installer.ts), [catalog projection](../core/skills/catalog-context.ts), [model tool](../core/skills/skill-tool.ts), and [manager tests](../core/skills/skill-manager.test.ts).
