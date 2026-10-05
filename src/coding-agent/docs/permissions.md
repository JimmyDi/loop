# Permissions and Process Sandboxing

Managed coding sessions constrain built-in tool execution through a session permission preset. The policy lives in coding-agent/core; Agent remains the model and sequential tool loop. The [Web permission picker](../../web-ui/frontend/docs/permissions.md) and [CLI commands](cli.md#permissions-and-approvals) select these presets and answer individual approval requests through core APIs.

## Presets

| Preset | File tools | Bash | Approval policy |
| --- | --- | --- | --- |
| read-only | Reads allowed; writes and edits denied | File writes denied, except required sinks such as /dev/null | ask |
| workspace-write | Writes and edits inside the canonical workspace, excluding protected Loop storage | Workspace and a private per-call temporary directory writable | ask |
| danger-full-access | Unconfined regular-file writes and edits | No process sandbox; host permissions apply | never |

The built-in default is read-only. Restricted Bash also blocks networking, including loopback, and uses an environment allowlist. This is a separate fixed network policy in this implementation, not a claim that a filesystem preset inherently prevents networking. Model requests still run in the host and can reach the configured provider.

The table describes default authority. Managed write/edit operations outside that authority can request [one-call approval](approvals.md), except writes overlapping protected Loop storage. Bash accepts sandbox_permissions (use_default or require_escalated) and requires a nonempty justification for escalation. A granted shell request runs that exact invocation without a sandbox, with host filesystem, network and environment access, including normally protected storage. File tools reject sandbox_permissions; their optional justification is display-only text and cannot grant authority. Missing handlers fail closed. No command is automatically retried with wider authority. Never means do not ask, not approve automatically; full-access sessions already execute with host authority.

## Usage and configuration

From the repository root, a host can create a managed session and change its preset while idle. This example creates no model response:

```typescript
import { createAgentSession, SessionManager } from "./src/coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  permissionPreset: "read-only",
});
try {
  await session.setPermissionPreset("workspace-write");
  console.log(session.state.permissionPreset);
} finally {
  session.dispose();
}
```

Public APIs:

- createAgentSession({ permissionPreset }): explicit trusted-host selection, overriding a restored preset.
- session.permissionPreset and state.permissionPreset: effective preset for managed tools.
- session.setPermissionPreset(preset): persist, then publish permission_changed. Busy, disposed, invalid-value and pending-save cases reject. A storage failure leaves the previous permission effective.
- SettingsManager.inMemory(model?, permissionPreset?): supply a default for new sessions.
- PermissionPreset, ApprovalPolicy, DEFAULT_PERMISSION_PRESET, isPermissionPreset, approvalPolicyFor and PermissionError: public types and helpers.
- createBashTool, createWriteTool and createEditTool accept a second ToolPermissionOptions argument with permissionPreset and additional protectedPaths. Standalone factories also default to read-only.

The optional settings.json permissionPreset field changes future-session defaults. Model fields may be omitted together; unknown fields and invalid presets reject. The Web picker and CLI /permissions command change only the active session. CLI --permission-preset overrides the startup session explicitly. No project-level permission defaults are added.

Web also provides Settings → General → Permission, stored separately in web-ui/settings.json under the agent directory. The Web bridge passes this override only when creating a new session across any project. Existing sessions and CLI/SDK defaults remain unchanged; see the [Web default contract](../../web-ui/backend/docs/permissions.md#new-session-default).

Direct new AgentSession calls with host-provided tools are a trusted extension surface. They do not claim managed enforcement, expose no effective preset, and reject setPermissionPreset. Use createAgentSession with built-in tool names for managed permissions; a TypeScript type or arbitrary custom tool is not an isolation boundary.

## Persistence and migration

The precedence is explicit SDK selection, saved session preset, then new-session settings. A restored legacy session without a preset uses read-only regardless of a full-access global default. The factory records the resolved selection before enabling tools. New drafts keep metadata in memory until their first user message, as before.

Managed permission metadata upgrades the header to version 2. Version 2 requires a valid permissionPreset. Version 1 files remain readable and are upgraded when the managed factory records a preset. Older Loop binaries reject version 2 instead of silently running protected sessions without enforcement. Do not downgrade a header to use it in an older binary.

Long-lived presets and the [runtime-context snapshots](runtime-context.md) supplied to the model are stored. The first request and later policy changes add a complete context snapshot after retained history; unchanged policy adds none, and the system prompt remains stable. Approval requests and decisions stay in memory, with no persisted pending approvals or reusable grants. A session's sandbox workspace is fixed from its canonical cwd when tools are constructed; replacing that path with a symlink fails policy resolution. Changing a shell's working directory does not expand write authority.

## Enforcement

File tools resolve existing ancestors and symbolic links, including dangling links, before making directories or writing. They serialize mutations and recheck paths before atomic replacement. Replacing a regular file avoids mutating another path through an existing hard-linked inode. New files use mode 0600; replacements preserve ordinary mode bits, not ownership, ACLs or extended metadata.

One-call file approvals bind the validated arguments, canonical target and resulting content digest. They allow only that replacement and the necessary parent/temp-file work, and do not grant a writable directory for future calls. Changing the target, original content/file identity, existing parent identity or preset while awaiting approval invalidates the decision. Generic SDK requests do not create execution permits. Approval metadata stays out of stored history; ordinary tool calls and results are still persisted.

The configured agent directory, default agent directory and current session-storage directory are protected from restricted tool writes, even inside a workspace. Host persistence is outside the sandbox and can still save history. If storage occupies the whole workspace, that whole directory is protected: put runtime data in a separate directory. Full access intentionally removes these tool fences.

On macOS, Bash is launched through the system sandbox-exec with a Seatbelt profile. File writes are denied by default, workspace and private temporary grants are added, and protected roots remain denied. Network access, Mach service lookup and access to other processes are restricted. The executable is deprecated by Apple; a missing or refusing runner fails closed.

On Linux, the system bwrap executable must be installed in /usr/bin or /bin, with working user namespaces. Bubblewrap mounts the host root read-only, adds writable workspace/temp binds, then overlays protected storage as read-only. It uses separate user, PID, network, IPC and UTS namespaces and drops capabilities. A protected path that does not exist is covered by its nearest existing ancestor, which may conservatively restrict more of the workspace. There is no Landlock fallback in this version.

Each restricted launch probes the actual profile with a harmless command before dispatch. Missing, unsupported or unusable runners raise SANDBOX_UNAVAILABLE. The subsequent command still executes through the runner; a launch failure never falls back to ordinary Bash. An ordinary nonzero result includes the active preset, without claiming that every failure was caused by the sandbox. Failed commands may have partial effects and are never automatically repeated.

The private temporary directory is per Bash call, shared by that command's descendants, and removed when the call finishes or is cancelled. It is not a shared session filesystem. Full output retained after truncation stays in a separate host-owned output file. Confined environments forward only PATH, HOME, LANG, LC_ALL, TERM and TZ, and set TMPDIR/TMP/TEMP. Credential variables and interpreter startup hooks are not inherited. Full access retains the host environment. Normal process-group cancellation, timeout and output truncation remain available in all modes; detached background jobs remain unsupported.

## Limits

- This feature controls model-invoked built-in tools, not trusted SDK code, the Loop host, arbitrary plugins, or hostile same-user host processes.
- Reads are not restricted to the workspace. This is not a credential-isolation or complete data-exfiltration boundary.
- File checks narrow but do not eliminate filesystem races. A different process can change paths between checking and a syscall.
- Shell filesystem restrictions are path/mount based. Pre-existing hard links inside a writable tree can alias outside files; kernel/filesystem/platform gaps must not be described as complete machine isolation. Use an isolated filesystem/container for that threat model.
- Linux network namespaces block IP networking, but accessible local Unix sockets are a separate IPC surface. This implementation is not a general service-isolation boundary.
- Windows restricted Shell execution is unsupported and fails closed; full access or an approved unsandboxed call still requires an installed Bash. Approval does not classify command risk or add user-account authentication. Without a connected Web approval interface or interactive CLI terminal, additional authority fails closed.

## Source and validation

[Policy](../core/permissions/policy.ts) / [tests](../core/permissions/policy.test.ts), [file mutation](../core/permissions/write-file.ts) / [tests](../core/permissions/write-file.test.ts), [runner](../core/sandbox/launcher.ts) / [integration tests](../core/sandbox/launcher.test.ts), [profiles](../core/sandbox/profiles.ts) / [tests](../core/sandbox/profiles.test.ts), [session](../core/agent-session.ts) / [tests](../core/agent-session.test.ts), and [storage](../core/session-manager.ts) / [tests](../core/session-manager.test.ts).

The integration test runs the real native backend on macOS/Linux, checking inside/outside writes, descendants, protected storage, read-only mode, private temp cleanup and blocked loopback requests. Linux execution requires Bubblewrap and enabled user namespaces; profile construction tests alone do not establish Linux runtime enforcement.
