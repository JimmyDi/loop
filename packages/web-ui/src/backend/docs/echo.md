# Echo

Echo is a separate navigation surface for persistent Agent profiles and shared
conversations. Agents have a name, instructions and an optional uploaded avatar.
Agents without an uploaded image use the built-in bot avatar. Users open one
private conversation per Agent or create group conversations with two or more
Agents, invite Agents to groups and explicitly select the next responder. One Agent
runs at a time per conversation; there is no automatic delegation or messaging.

## Usage

Open Echo in the navigation bar or at /echo. The route survives refresh and browser
history navigation. New Agent, New group chat and Connection open focused dialogs.
Choose Agents in the group dialog or select an Agent card for its private chat.
Agent cards show their latest message and activity date once a chat exists. Group
conversations appear in the conversation list with the same card layout.
Configure Connection with a Loop Sandbox service URL and token. Choose an existing
computer or New computer. Start stopped computers
before asking for remote work. Several conversations may select the same computer.
Bound desktop computers open their side panel by default beside the conversation on
wide screens and below it on narrow screens. The panel can be closed and reopened.
A stopped computer shows its state there; starting it resumes
authenticated PNG preview polling without acquiring control.

## Storage and API

All state is local under the configured agent directory:

- echo/echo.json: versioned profiles, membership, responder, connection metadata and
  remote computer bindings. Serialized atomic writes reject invalid records.
- echo/connection.secret: write-only connection credential, mode 0600 on POSIX.
  It is plaintext on disk; protect the agent directory and its backups.
- echo/conversations: native SessionManager history, metadata and context records.
  Credentials are never included in messages or API list responses.

GET /api/echo returns state and recent message previews. POST /api/echo/agents
creates profiles and accepts an optional PNG, JPEG or WebP data URL up to 256 KB.
POST /api/echo/conversations creates conversations and reuses an existing private
conversation for a single Agent, including older one-member conversations. PUT /api/echo/conversations/{id}
changes membership, responder or computer. PUT /api/echo/connection saves the
connection. Changing the endpoint clears computer bindings and requires re-entering
the token. Existing computer files are not deleted.

Computer listing, creation and start/stop/rebuild use /api/echo/computers.
Deleting a computer through DELETE /api/echo/computers/{id} clears every local
conversation binding to it. The confirmation dialog explains that the sandbox
retains file volumes by default. Busy Echo sessions reject deletion.
Creation accepts a stable requestId. The UI does not retry uncertain creation.
Conversation streaming, prompts, approvals and history use existing session routes,
routed to an independent Echo registry. Project/global chat listings exclude Echo.
File links download from the remote workspace rather than the host filesystem.

## Lifecycle and limitations

Membership and binding changes reject while Echo executions are active. Switching
the responder rebuilds the session with retained history and a new Agent persona.
Replies retain their Agent label. Echo exposes remote tools only, with normal
session permissions, no local skills, MCP configuration or Plan execution.

One saved connection is currently supported. Agent editing/deletion, conversation
archiving, remote file inline preview, interactive human desktop takeover and voice
controls are not yet exposed in Echo. Remote tools provide screenshots and desktop
input; watching is read-only. A transient preview failure keeps the last image while
polling continues. The shared sandbox remains trusted personal infrastructure.
Idle stop and file retention are controlled by the sandbox service.

See [computer integration](../../../../coding-agent/src/docs/computers.md).
Source: [service](../echo/service.ts), [routes](../echo/routes.ts), [storage](../echo/store.ts).
