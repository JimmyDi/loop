# Codemode

Codemode lets the model discover and call tools from JavaScript, then return selected results instead of every nested response. Coding-agent supplies this capability; the minimal Agent remains unchanged. A run with ready MCP tools automatically receives `codemode`, while MCP schemas stay outside the initial model request.

## Minimal usage

Connect an MCP server in Web Settings, wait for it to become ready, and ask Loop to use it. No new server configuration is required. The model sees a service directory in `<mcp_servers>` and submits `codemode({ code })`. This script illustrates discovery and inspection; replace the service ID with the installed service's ID:

```javascript
const matches = await searchTools("list directory", { namespace: "filesystem" });
text(matches);
text(await describeTool(matches[0].name));
```

After inspecting the schema, a subsequent script can call the discovered tool with its actual parameters:

```javascript
const matches = await searchTools("list directory", { namespace: "filesystem" });
const result = await tools[matches[0].name]({ path: "<allowed-directory>" });
text(result.content);
```

The model can combine calls, loop over results and emit selected fields. Ordinary tools remain directly available and are also callable through the script. Codemode cannot call itself. With no ready MCP tools, the generated entry is absent. A host custom tool named `codemode` conflicts with the generated entry and rejects that run.

## Script API

The `code` argument is raw JavaScript evaluated as an async function body. Top-level `await` and `return` work.

| API | Contract |
| --- | --- |
| `await searchTools(query, { limit?, namespace? })` | Search names, descriptions and server IDs; return name, description and namespace metadata. Default limit 10, maximum 50. Query length is at most 1000 characters. Namespace is an exact server ID or `builtin`. |
| `await describeTool(name)` | Return one tool's name, description, namespace and complete parameter schema. |
| `await describeNamespace(serverId)` | List names and descriptions for one exact namespace. |
| `ALL_TOOLS` | Script-local name/description metadata; names are JavaScript identifiers. |
| `await tools[name](args)` | Call with an argument object. MCP tools resolve to `{ content }` with text/image blocks; ordinary tools resolve to text. Failures reject inside the script. |
| `text(value)` / `return value` | Emit a string or JSON value into the final tool result. |
| `image(block)` | Emit a supported base64 image block or data URL; remote URLs are unavailable. |
| `console.log(...)` | Emit text output. |
| `exit()` | End successfully; pending tool calls are cancelled. |

Scripts have no Node globals, filesystem, network, module imports or timers. Discovery helpers do not install or connect servers; they search the run's captured catalog. Nested results enter model context only when emitted. A compact nested-call status summary accompanies output. MCP `structuredContent` is not exposed by the current adapter.

## Lifecycle and permissions

Each invocation starts a fresh QuickJS WebAssembly VM in a separate Node worker through the `@earendil-works/pi-codemode` dependency. Distribution builds keep this dependency external so its worker and WASM assets remain available. Runtime store/load writes last only for the current script; there is no persistent script state.

Nested calls use the model runtime's argument validation and the same host approval bridge as ordinary tools. Child approvals identify the actual tool and captured arguments with IDs derived from the parent call and a counter. File and shell checks remain authoritative. MCP Full access, Allow once and exact tool/session grants retain their behavior. Each child has an independent approval context; scripts never receive approval handles or host executors.

Calls execute sequentially even with `Promise.all`. Script lifetime and cancellation combine with tool signals. Disabling, reconnecting or refreshing a server invalidates captured tools and grants. New catalogs enter the next user prompt. Failures become failed tool results, preserving partial text and identifying calls that ran. Earlier effects are not rolled back; no automatic retries occur. Unawaited calls are cancelled when the script settles, but cancellation cannot guarantee rollback of dispatched external work.

## Limits

- Source: at most 64 KiB.
- Nested calls: at most 64 per invocation.
- VM heap: 256 MiB.
- Deadline: five minutes, including approvals and tool calls. An optional first line `// @options: {"timeout_ms": 30000}` shortens it; larger deadlines reject. Each MCP call retains its own deadline.
- Text: at most 20 KiB and approximately 5000 tokens by default. The options field `max_output_tokens` can lower the allowance. Truncation is explicit and preserves Unicode boundaries; failure and call summaries are reported separately. Omitted text is not saved to a file; emit compact summaries.
- Emitted images: at most 4 MiB decoded in total; excess images are explicitly omitted.

Search uses case-insensitive term matching rather than semantic retrieval. Deferred direct declarations, persistent script state, model calls inside scripts and additional MCP exposure settings are not implemented. Scripts and emitted results enter saved tool history; full nested responses are not stored separately.

## Source and tests

[Tool](../core/codemode/tool.ts), [discovery](../core/codemode/catalog.ts), [output](../core/codemode/output.ts), [tests](../core/codemode/tool.test.ts), [approval bridge](../core/approvals/tool-approvals.ts), and [MCP integration](mcp.md).
