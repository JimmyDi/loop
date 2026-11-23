# Remote computers

ComputerProvider defines the remote computer transport. LoopSandboxProvider is the
current HTTP implementation. The minimal Agent does not know about computers.

## Usage and configuration

Import LoopSandboxProvider and createComputerTools from the public coding-agent
entry. Supply a provider getter, a host-owned binding getter and a workspace label.
The binding contains computerId and actor (conversation_id, agent_id, execution_id).
Create a fresh execution identity per prompt; models never supply these identities.

Pass the returned tools to createAgentSession as customTools with remoteOnly: true.
customTools replaces built-in tools. remoteOnly omits local skills and MCP and rejects Plan
mode. It does not confine arbitrary host-supplied tools: the host must supply only
the intended remote capabilities. Optional assistantLabel adds presentation metadata
to assistant history without changing its model role.

The HTTP adapter accepts endpoint, token and optional timeoutMs (default 60000).
Credentials remain in request headers. Redirects are rejected. The adapter never
retries business calls. Echo stores one connection separately from conversation
bindings; SDK hosts may inject another ComputerProvider implementation.

## Lifecycle and errors

Lifecycle and bindings are host-managed. Tools do not create, start or destroy a
computer. An unavailable or stopped computer fails; there is no local fallback.
The provider destroy call keeps retained file volumes by default.
Operations record request IDs and attribution. A generation change within one
execution fails. Query computer_operation_status after uncertain delivery before
deciding what to do next. Unknown outcomes do not authorize replay.

Remote operations use session approvals. Full access permits dispatch automatically;
other presets require Allow once or an exact tool/session grant. Desktop tools
acquire an execution-owned lease and renew it on subsequent calls; hosts use the
onLease callback to release leases after their run. Expiry is the crash fallback.
Changing ownership invalidates screenshots, so input requires a new screenshot.
The host validates browser and desktop action names before requesting approval or
dispatching. Browser supports open, set_content, snapshot, click, fill and screenshot.
Desktop supports screenshot, click, type, keypress and scroll. Legacy desktop key
actions are translated to keypress; a single space key becomes the X11 name space.
Keyboard input requires a fresh screenshot_id. Browser keyboard shortcuts must use
desktop keypress. Invalid actions fail locally with an actionable error.

## Limits and source

The current provider supports persistent files, processes, browser, desktop,
downloads and PNG previews. It assumes the implemented Loop Sandbox Echo API;
other providers must explicitly implement their supported operations. No provider
discovery registry or deployment management is included.

Source: [contract](../core/computers/types.ts), [HTTP adapter](../core/computers/loop-sandbox.ts),
[tools](../core/computers/tools.ts). Tests are colocated.
