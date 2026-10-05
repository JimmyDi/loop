# Session Archive

SessionArchive persists archive membership independently of conversation files. Archiving and restoring preserve history; a separate explicit delete operation permanently removes selected history. Application hosts decide which lists exclude archived IDs and where users can view, restore or confirm deletion. Web exposes these controls in session and project menus and Settings.

## Usage

Import SessionArchive and getSessionDir from the public coding-agent entry. Construct one archive per session directory, read its ID set with list(), and call set(sessionIds, true) to archive or set(sessionIds, false) to restore. Await each result before updating visible state.

| API | Contract |
| --- | --- |
| new SessionArchive(sessionDir) | Select a history directory; constructing does not write |
| list(): Promise&lt;Set&lt;string&gt;&gt; | Read archived IDs after this instance's queued writes finish |
| set(ids: string[], archived: boolean): Promise&lt;void&gt; | Atomically update all selected IDs; repeated archive/restore is idempotent |
| delete(cwd: string, ids: string[], options?: { archivedOnly?: boolean }): Promise&lt;void&gt; | Permanently delete selected history belonging to cwd. All IDs must exist. archivedOnly defaults to true; false explicitly permits deleting unarchived history too |

The Web bridge validates that every selected ID belongs to the project before calling set. SDK hosts must perform their own ownership/existence validation and prevent conflicting application operations. SessionManager.list and CLI continuation continue to include all sessions; archive filtering is explicit in the host.

## Storage and failures

Membership is a JSON array of session UUIDs in archive.json beside the project's JSONL history files. A missing index means no archived chats. Writes serialize through one instance, use a private temporary sibling file, and atomically replace the index. Archive writes cannot overwrite live history or title saves, because they never modify the history files.

Invalid metadata and invalid IDs reject. Read or write failures leave existing membership intact; callers can retry after resolving the error. Archive membership survives project removal and re-registration because it is stored by canonical history directory rather than the Web project ID.

Deletion validates the complete selection before moving files into a private temporary staging directory. If staging or index replacement fails, it attempts to restore moved history before rejecting. After membership is updated, it purges staged files. A purge failure rejects and can leave staged data requiring cleanup, while those sessions are already absent from the normal list. A process crash during deletion can also leave staged files; there is no automatic crash recovery or power-loss guarantee. Callers must drain title/history writes and dispose deleted live sessions to prevent old instances from recreating history.

## Limits

Reuse one instance per directory. There is no locking across instances or processes. Atomic replacement does not guarantee power-loss durability. This API does not cancel runs or enforce an approval UI. The Web registry separately rejects archive, restore and deletion while a project is loading, creating, running or has unsaved history.

## Source and tests

- [SessionArchive](../core/session-archive.ts) / [tests](../core/session-archive.test.ts).
- [Web archive routes and lifecycle](../../../web-ui/src/backend/docs/projects.md).
