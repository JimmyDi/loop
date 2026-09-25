# Projects and Directories

Project registration maps a local directory to a workspaceId so the browser can create and restore sessions. Removing registration does not delete the directory or SDK conversation history.

## Project API

| Endpoint | Input and result |
| --- | --- |
| GET /api/workspaces | Return id, name, cwd, and accessible |
| POST /api/workspaces | Accept path and optional name; return the registered project |
| PATCH /api/workspaces/:id | Accept name and update the display name |
| DELETE /api/workspaces/:id | Remove registration; return 204 on success |

path must be an absolute directory. Registration resolves it with realpath and checks read/traversal permissions. The same directory or a symlink to it reuses the existing project. The default display name comes from the directory name. Listings retain unavailable directories with accessible set to false.

## Persistence and Concurrency

ProjectStore saves the project array to `<agentDir>/web-ui/projects.json`. Writes are serialized within the process, using a temporary sibling file and atomic replacement. Invalid content reports an error rather than being overwritten with an empty list.

SessionRegistry guards removal. Pending loading/creation, an active session, or unsaved history returns project_busy (409). New session operations are blocked during removal. Success disposes instances and clears sessionId-to-workspaceId mappings. Registering the same directory again exposes its existing SDK sessions.

## Directory Selection API

| Endpoint | Behavior |
| --- | --- |
| GET /api/directories/capabilities | Return native and preferred |
| GET /api/directories?path=… | Return canonical path, parent, home, immediate subdirectories, and truncated |
| POST /api/directories/pick | Return the system-selected path, or null on cancellation |

Browsing starts at the home directory if no path is supplied. Entries are sorted by name and include directories or symlinks to directories. At most 1000 candidates are inspected; larger listings set truncated. Missing or unreadable paths report directory_unreadable.

Native selection supports only non-SSH macOS environments, with one window at a time. Request cancellation reaches the picker process; user cancellation is not an error. Other environments use browser-based directory navigation.

## Boundaries

Directory browsing accesses the server's local filesystem; it is not file upload or remote file management. A registered directory is the tools' working directory, not a security sandbox. Session APIs accept project/session IDs, not arbitrary session file paths. Storage has no cross-process write lock; CLI and Web should not write the same session simultaneously.

## Source and Tests

- [Project routes](../routes/projects.ts) / [HTTP tests](../router.test.ts).
- [ProjectStore](../projects/project-store.ts) / [tests](../projects/project-store.test.ts).
- [SessionRegistry](../session-registry.ts) / [removal and load-race tests](../session-registry.test.ts).
- [Directory browsing](../directories/browse.ts) / [tests](../directories/browse.test.ts).
- [Native picker](../directories/native-picker.ts) / [tests](../directories/native-picker.test.ts).
