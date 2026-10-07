# Skill endpoints

Skill management shares the local request and JSON validation described in [HTTP boundaries](http.md). The backend owns one shared public `SkillManager`, injects it into sessions and closes it during shutdown. Scanning is asynchronous and does not block server startup.

## Routes

All paths start with `/api/settings/skills`. Optional `?workspaceId=<id>` selects a registered project and its personal/project catalog. Without it, only personal skills are listed.

| Method and suffix | Input / result |
| --- | --- |
| GET `/` | Current `SkillCatalog`, including scanning/error state |
| POST `/refresh` | Await scan and return catalog |
| POST `/preview` | `SkillPreviewInput`; return `SkillJob` with status 202 |
| GET `/jobs/<id>` | Current job stages/candidates/error |
| DELETE `/jobs/<id>` | Cancel; status 204 |
| POST `/install` | `{ jobId, keys, scope, updateId? }`; install and return catalog |
| GET `/<skillId>` | Summary and current instruction body |
| PATCH `/<skillId>/enabled` | `{ enabled: boolean }`; return catalog |
| POST `/<skillId>/update` | Preview a managed GitHub update; status 202 |
| DELETE `/<skillId>` | Uninstall an owned managed folder; return catalog |

Project installs require `workspaceId`. Source kinds are `github`, `local` and `created`. Jobs expose real downloading, checking or installing stages rather than a percentage. Error inputs and `SkillError` failures return status 400; ordinary filesystem failures follow the shared HTTP error contract. Failed installations leave the prior installation intact.

## Chat

POST `/api/sessions/<id>/prompt` accepts optional `skills: string[]`, with at most eight 24-character hexadecimal source identities. Selection participates in request deduplication. New selections are validated before accepting the run; unavailable skills return a 400 error so the browser retains the draft. Replays use the previously accepted request without rereading skill files. Core rechecks availability when the run starts. Loaded skill events project into session state and saved runtime-context snapshots.

The management routes neither execute scripts nor alter tool approval policy. See [core skills](../../../../coding-agent/src/docs/skills.md) for discovery, storage, limits and lifecycle.

## Source and tests

[Routes](../routes/skills.ts), [route tests](../routes/skills.test.ts), [session controller](../session-controller.ts), and [server](../server.ts).
