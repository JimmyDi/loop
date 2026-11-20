# Disposable sandbox execution

Sandbox sessions use a dedicated Streamable HTTP MCP connection. Local workspace
tools, local skills and globally configured MCP servers are excluded. The model
receives the selected provider catalog. The legacy direct connection exposes
read_file, write_file, edit_file, exec, get_process and cancel_process.
The minimal agent loop is unchanged.

## SDK and CLI

Pass an execution option to createAgentSession with type sandbox, url pointing to
the MCP endpoint (including its trailing slash), and tokenEnv naming the credential
environment variable. For example, use the public SDK with:

```ts
import { createAgentSession } from "@loop-harness/loop";

const { session } = await createAgentSession({
  execution: {
    type: "sandbox",
    url: "http://localhost:8080/mcp/",
    tokenEnv: "LOOP_SANDBOX_TOKEN",
  },
});
```

For CLI use `loop --sandbox-url http://localhost:8080/mcp/` and set
LOOP_SANDBOX_TOKEN in the host process. Saved sessions restore the execution
configuration. The token value is not saved in session metadata. URLs must not
contain credentials, query parameters or fragments. Use HTTPS on untrusted networks.
The server must provide the six session sandbox tools; arbitrary MCP catalogs are
not execution backends. Every request carries Loop-Session-Id equal to the saved
Loop session ID. Credentials never enter model tool arguments.

## Web

Run loop sandbox connect or set LOOP_SANDBOX_URL and LOOP_SANDBOX_TOKEN before starting the Web server.
New chats offer Local and Loop Sandbox beside project selection. Changing the
environment creates a new draft and retains composer text and model preferences.
After the first message the environment is fixed. The header shows the selected
environment and last observed generation, not a live health probe. Connection
details are configured by the operator and are not accepted from the browser.
The local project identifies chat storage only: no files are uploaded.

## Permissions and limitations

Tools use the existing MCP approval flow. Full access permits remote tools without
prompts; other presets require approval and support per-tool session grants.
Plan mode and local skills are unavailable in sandbox sessions in this version.
File/image links never fall through to local filesystem access.

Tool results include generation and reset status, and model-visible operation
errors. The header warns when a new generation discards files. Commands are never
automatically retried after uncertain results, and there is no local fallback.
Stop cancels known active remote processes on a best-effort basis. If the command
submission result was lost, it may continue until its server timeout. Use
cancel_process to stop a known background job explicitly.

History is stored locally. Workspace files and processes are disposable. There is
no project upload, snapshot restore, persistent volume, remote browser tool or
automatic artifact download in this first version. Disconnecting does not delete
the remote sandbox immediately.

## Verification

Focused tests cover persistence, tool exclusion, UI state and original local
sessions. The opt-in core/execution/sandbox.e2e.test.ts drives the actual tool loop
with a synthetic model stream against live MCP and Docker. Set
LOOP_SANDBOX_E2E_URL and LOOP_SANDBOX_TOKEN to run it. No model provider is called.

## Saved connections and token rotation

Run the interactive setup before starting Loop:

~~~bash
loop sandbox connect
loop --sandbox
loop web
~~~

Enter the MCP URL and token at the prompts. Token input is hidden and never a
command argument. Use HTTPS except on localhost; a bare origin becomes /mcp/.
macOS uses Keychain; Linux uses Secret Service via secret-tool. Secrets go to the
credential command over stdin, never argv. Setup fails if the store is unavailable.
On headless Linux or other systems explicitly choose loop sandbox connect --file
to store the connection and token in a private mode-0600 sandbox-connection.json
under LOOP_DATA_DIR (default ~/.loop). Keychain mode saves only a URL and reference.
Setup saves without contacting the server; access is checked when MCP connects.
A locked/unavailable credential store fails the tool connection.

CLI --sandbox uses the saved connection; Web offers it in the environment selector.
An explicit --sandbox-url remains supported. LOOP_SANDBOX_URL and
LOOP_SANDBOX_TOKEN override saved configuration for automation. Existing SDK
execution configurations keep tokenEnv; a custom variable never falls back to
the default saved credential. Saved credentials are only used for the same URL.
Sessions persist the URL and credential variable name, never the secret.

After loop-sandbox rotate-token on the controller, run loop sandbox connect again
or update LOOP_SANDBOX_TOKEN and restart the client. A stable server-owned
client_id preserves session bindings across rotation. Sandbox lifetime is unchanged;
files still disappear after recycling. Failed in-flight calls are never replayed;
a later call can reconnect with updated saved credentials. CLI stays local unless
--sandbox or --sandbox-url is selected.

## Select a configured MCP provider

In Web, open Settings → MCP and add your sandbox service using its Streamable HTTP
URL or STDIO command. Configure authentication headers or environment references
there, enable it, and verify its tools are discovered. For Loop Sandbox use
http://127.0.0.1:8080/mcp/ (trailing slash). With controller authentication disabled,
leave token configuration empty.

Create a new chat and select the service by name in the execution environment
selector. Only that provider's tools and the user question tool are exposed;
local filesystem/terminal tools, local skills and other MCP services are excluded.
Switch providers before the first message; existing conversations retain their
selected server ID. Deleting, disabling or editing that configuration rejects
further dispatch from an existing provider connection; reload the conversation
(or create a new chat) to use updated settings. Secrets remain in MCP configuration,
not chat headers or selection API responses.

The equivalent SDK execution option is:

~~~typescript
const execution = { type: "sandbox", serverId: "my-sandbox" } as const;
~~~

Pass it to createAgentSession. Configuration is read from agentDir/mcp.json.
CLI users can select the same configuration with loop --sandbox-mcp my-sandbox.
The provider catalog is discovered on session load, with its names, schemas and
instructions preserved. No fixed six-tool requirement applies. Calls keep existing
MCP approval checks and do not retry or fall back to local execution. Catalog or
transport invalidation requires reloading the session.

Each chat gets a dedicated connection. Loop supplies Loop-Session-Id for HTTP and
LOOP_SESSION_ID for STDIO, overriding static values for these reserved fields.
Management discovery uses a separate loop-discovery HTTP identity and invokes no
business tools. MCP itself does not standardize sandbox identity, provisioning,
working directories or persistence. A provider must consume the session identity,
manage its lifecycle, or expose tools for the model to manage its own sandbox ID.
The /workspace prompt is a convention; provider instructions and schemas define
actual paths. This supports different MCP catalogs; it does not make every sandbox
vendor's HTTP API MCP-compatible automatically. A STDIO provider runs a local
adapter process and determines where its tools execute.

Generation display and best-effort process cancellation are optional extensions
for providers returning Loop-compatible sandbox/process results. Generic MCP
request cancellation cannot guarantee termination of a detached background job.
