# MCP servers

McpManager owns saved MCP configurations, background discovery, connections and external tool adapters. Web uses one shared manager across its sessions. The minimal Agent remains unchanged.

## Minimal usage

Web users open **Settings → Integrations → MCPs → Add → Add MCP server**. Save a STDIO executable/arguments or Streamable HTTP URL. The form preserves its scroll position while showing the saved configuration’s background connection status, returns to the server list on success and stays open on failure. Back returns to the list while discovery continues. The next prompt can use connected tools.

SDK hosts create a manager, pass it to createAgentSession with `mcpManager`, register a session approval handler, and close the manager after shutting down their sessions. The SDK does not own or dispose a supplied manager. Import McpManager, McpServerConfig and createAgentSession from the public package entry. CLI does not automatically load this configuration.

## Configuration and API

Web stores `<agentDir>/mcp.json` outside projects; LOOP_DATA_DIR changes the root. Version 1 contains a `servers` array. Writes are serialized and atomically replaced with owner-only file mode on POSIX. Values are plaintext on disk, not encrypted; Windows protection follows the account's directory ACL. Missing files mean no servers; malformed files fail without being overwritten. Repair them and restart the manager.

Every server has a unique `id`, display `name`, `enabled` boolean and `transport`:

| Transport | Fields |
| --- | --- |
| `stdio` | `command`, `args: string[]`, `env: {key,value}[]`, `envVars: string[]`, `cwd` |
| `http` | `url`, `bearerTokenEnv`, `headers: {key,value}[]`, `envHeaders: {key,value}[]` |

STDIO spawns the command directly without a shell. Arguments are separate entries, without shell splitting or expansion. Working directory is optional; nonempty values must be absolute. An empty directory inherits Loop's launch directory, not the session project. A minimal platform environment is inherited; envVars names are explicitly passed through, and literal env values override them. Starting an enabled STDIO server grants the configured process host access, independently of built-in tool sandbox permissions.

HTTP accepts HTTP/HTTPS URLs without URL userinfo or fragments. bearerTokenEnv names an environment variable used for Authorization. envHeaders maps header keys to environment variable names. References are resolved from Loop's process environment on connection; missing variables fail discovery. Duplicate header names are case-insensitively rejected; a configured bearer reference cannot coexist with an Authorization header. Cross-origin redirects and automatic OAuth are not supported.

Literal env/header values are write-only in list(): their values are empty and `saved: true`. Retain the same key and saved marker with an empty value to preserve it. Remove the row to delete it. New literal values replace old values. Changing a STDIO command, arguments or cwd, or an HTTP URL, requires re-entering preserved secrets. Do not put credentials in command arguments or URLs, which remain readable configuration fields.

| McpManager method | Behavior |
| --- | --- |
| constructor(file) | Schedule asynchronous config loading and discovery |
| list() | Await local config writes, return redacted status snapshots |
| save(config, create?) | Persist a validated new/update config; create rejects duplicate IDs; STDIO setup gets an extended discovery deadline |
| setEnabled(id, enabled) | Persist enabled state and invalidate changed connections |
| remove(id) | Remove config and invalidate connection |
| retry(id) | Start fresh discovery for an enabled server |
| tools(workspaceRoot) | Snapshot currently ready tools for a host session |
| close() | Stop discovery, invalidate tools and close connections |

## Lifecycle and errors

Startup and prompt dispatch never await MCP discovery. At most three connections initialize concurrently. Saving an enabled STDIO configuration allows up to 120 seconds for initialization and discovery, including any first-launch package download performed by the configured command. This is a transient setup allowance, not a persisted timeout setting. Startup, re-enabling, list Retry and HTTP saves retain a 15-second overall discovery deadline and a 10-second initialization deadline. Each tools/list request retains its 10-second deadline. Saving an unchanged ready connection preserves it; saving an unchanged failed or pending connection starts a fresh setup attempt. Disabled configurations are saved without connecting. Discovery calls initialize and paginated tools/list only, with a 500-tool cap and repeated-cursor protection. It never invokes business tools to test connectivity. Servers without the tools capability connect with zero tools; resources/prompts are not exposed.

Status is disabled, queued, connecting, refreshing, ready or error. Queued means waiting for a discovery slot. Management errors contain stable codes for missing environment variables, missing commands/directories, authentication/access rejection, timeouts, closed connections, invalid catalogs and failed refreshes; raw server errors and stderr are never exposed. Failed or disconnected servers require explicit Retry, editing or re-enabling. No automatic reconnect or business-call replay occurs.

A tools/list_changed notification invalidates the previous tool snapshot and pending approvals/calls, then refreshes the catalog on the existing connection without restarting the server. Each refresh has a 15-second deadline and the same catalog bounds as startup discovery. Notifications during a refresh are coalesced into a subsequent pass; no concurrent catalog swaps occur. The complete latest catalog becomes available on the next user prompt. A failed refresh closes that connection, leaves configuration intact and offers Retry. Disabling, deleting or changing configuration prevents late discovery results from becoming active.

Each user prompt snapshots ready tools before creating its Agent. Newly ready tools join the next prompt; an in-flight request's tools never change. Tool names include a server/tool hash to avoid normalization collisions and fit common provider limits. Core execution events carry an optional toolDisplayName using the server display name and original full tool name. MCP result details store loopDisplayName for restored presentation without changing toolName or toolCallId; existing stored labels survive renaming and disabling. Legacy results without labels can be presented using the currently ready tool catalog; unresolved legacy names remain internal identifiers. Display labels are not tool dispatch keys or tool schemas. Schemas enter the existing context budget and model-runtime argument validation. Results preserve text/images; other content blocks become JSON text. External results may contain sensitive data and enter model context and saved history.

## Call permissions

MCP calls use the same live session permission preset as built-in tools. Full access allows calls without confirmation. Read only and Workspace write require approval unless the exact tool has a live-session grant. MCP settings contain connection configuration and the server enable switch, without separate server or tool permission controls. Disabling a server makes its tools unavailable.

The session preset controls call authorization, not the external server's filesystem or network scope. Server read-only/destructive declarations never bypass approval or constrain the server. Connection setup and discovery remain independent of call authorization; starting an enabled STDIO process still gives that program host-user access.

Legacy approvalMode and toolPolicies fields are ignored when reading configuration and omitted on the next configuration write. All enabled tools inherit session permissions, including tools added later. There is no per-tool disable control; disable the server to remove its tools.

MCP approval cards offer Allow once, Deny, and **Allow this tool for this session**. The last submits `allowed-session` only when the host-created request advertises `allowSession`. It covers that exact tool with any arguments, rather than the entire server. Other operations reject this decision. Interactive terminal adapters offer `/approve-session REQUEST_ID` for the same eligible requests; CLI still does not automatically load MCP configuration.

Temporary grants live only in the owning AgentSession's memory and never in shared McpManager state or session files. They survive subsequent prompts and UI reconnects to the same live session, but not session disposal, reopening in a replacement instance, or a Loop restart. Grants bind the server's unique catalog lifetime and exact tool name. Connection configuration changes, disablement, deletion, connection replacement and catalog refresh revoke that lifetime and cancel pending calls. A display-name-only change preserves it. Stable configuration continues to use the same lifetime across prompts. Catalog refresh conservatively revokes all grants for that server.

Before dispatch, core checks the live session's Full access state, then consults exact tool/session grants or asks. Missing handlers, denial, timeout and cancellation prevent calls that require approval. Approval binds the actual sequential call ID, arguments and tool identity; configuration and cancellation are rechecked after waiting. Automatic decisions emit paired approval events with optional result.source of session-grant or full-access. Authentication failures and server refusals remain failures regardless of session permissions. Calls have a 60-second total deadline and never automatically retry. Timeout or cancellation cannot guarantee rollback of external side effects.

## Limits and related source

This feature supports MCP tools over STDIO and Streamable HTTP only. It does not install packages, perform OAuth, expose MCP resources/prompts, load skills or install plugin bundles. Server availability does not prove its tools are safe; call authorization follows the [approval contract](approvals.md) and session permissions.

Source and colocated tests: [manager](../core/mcp/mcp-manager.ts), [connections](../core/mcp/connection.ts), [configuration](../core/mcp/config-store.ts), [tool adapters](../core/mcp/mcp-tools.ts), [session integration](../core/agent-session.test.ts). See [context budget](context-budget.md).
