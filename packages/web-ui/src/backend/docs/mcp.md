# MCP settings endpoints

The Web server owns one coding-agent McpManager, supplies it to session factories and closes it at shutdown. Startup does not await MCP loading/discovery. Routes remain available while a server is connecting; config writes wait only for local persistence.

| Route | Behavior |
| --- | --- |
| GET /api/settings/mcp | Redacted servers, status, toolCount and safe error code |
| POST /api/settings/mcp | Create a server; duplicate IDs return 409 |
| PUT /api/settings/mcp/:id | Replace config; body ID must match an existing server |
| PATCH /api/settings/mcp/:id/enabled | Persist `{ enabled: boolean }` |
| POST /api/settings/mcp/:id/retry | Restart enabled server discovery |
| DELETE /api/settings/mcp/:id | Remove config and stop its connection |

Successful commands return `{ servers: McpServerView[] }` immediately after local persistence; they do not wait for discovery. POST/PUT saves allow a transient 120-second STDIO setup attempt, while HTTP, startup, enable and Retry retain normal deadlines. Status polling reports the result independently. All endpoints use the router's local host/origin checks and no-store responses. Unknown IDs return 404, invalid configs 400, duplicate IDs 409, storage errors 500. Failure messages contain stable codes, not raw server errors or secret values. Server snapshots distinguish queued, connecting, refreshing, ready, disabled and error; error rows include a safe connection/discovery failure code.

Configuration is global for the Web backend, shared across projects. It is stored through core in `<agentDir>/mcp.json`, independently of model/provider files and chat histories. Mutations do not take the session/model configuration lock. Connection configuration changes and disabling a server revoke its catalog lifetime, session grants and pending approvals/calls; display-name-only changes preserve that lifetime. MCP authorization uses live session permissions and temporary exact tool/session grants. Configuration contains no separate approval defaults or tool overrides; legacy permission fields are ignored and omitted on the next write. Ready tool snapshots are selected at each prompt; discovery never restarts a user's prompt.

See the public [core contracts](../../../../coding-agent/src/docs/mcp.md) for transport fields, write-only values, background limits, tool approvals and error behavior. The browser workflow is documented in [Integrations](../../frontend/docs/integrations.md).

Source: [routes](../routes/mcp.ts), [route tests](../routes/mcp.test.ts), [server](../server.ts), [session bridge](../loop.ts).
