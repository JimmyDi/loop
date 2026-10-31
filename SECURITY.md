# Security Policy

Loop is a local, single-user coding assistant with CLI, SDK and Web interfaces. Managed tool
permissions provide specific execution restrictions; they do not isolate the entire application
from the host computer or make untrusted content safe.

## Reporting a vulnerability

Use the repository's [private vulnerability report](https://github.com/JimmyDi/loop/security/advisories/new)
to contact maintainers. GitHub sign-in is required. Do not disclose security-sensitive details in
public issues, pull requests or discussions. If the private form is unavailable, request a private
reporting channel without publishing the vulnerability details.

Include:

- The affected Loop version or commit, operating system and relevant configuration.
- The active permission preset, approvals and integrations needed to reproduce the issue.
- A minimal reproduction using synthetic data in an isolated environment.
- The expected security boundary, observed behavior and demonstrated impact.
- Any known mitigation or proposed fix.

Remove credentials, personal data, private endpoints and unrelated working data from attachments,
logs and screenshots. Do not test against other users' systems or data without authorization.
Reports should distinguish verified behavior from assumptions; a dependency advisory alone does
not establish that Loop is affected.

## Supported versions and disclosure

Security fixes target the latest stable Loop release. Older releases do not have guaranteed
backports; update to the latest stable release before reproducing a report when practical. Reports
against current development code are also welcome.

Maintainers review the reproduction, determine affected versions and coordinate a fix, mitigation
and disclosure with the reporter. Response and resolution times depend on maintainer availability
and the issue; no fixed deadline is guaranteed. Keep details private while coordination is ongoing.
Published advisories are available under [GitHub Security Advisories](https://github.com/JimmyDi/loop/security/advisories).

## Trust model

### Managed tools and approvals

Managed sessions default to `read-only`. Built-in file writes and edits follow the session's
permission policy. Restricted Bash runs through Seatbelt on macOS or Bubblewrap on Linux, with
filesystem restrictions, blocked IP networking and a limited environment. An unavailable or
unsupported sandbox fails closed; restricted Bash is unsupported on Windows.

Approval can authorize an exact file replacement or one unsandboxed Bash invocation. Approved
Bash and its descendants receive host-user filesystem, network and environment access, including
normally protected Loop storage. `danger-full-access` intentionally removes these tool restrictions.
Model text, tool arguments and historical approval records cannot grant execution authority.

Reads are not confined to the workspace. The host still sends model input to the configured
provider. These controls are not credential isolation or a complete data-exfiltration boundary.
Filesystem races, pre-existing hard links and local IPC have additional limitations; see
[permissions and process sandboxing](packages/coding-agent/src/docs/permissions.md) and
[approval requests](packages/coding-agent/src/docs/approvals.md).

### Host code, repository content and integrations

Loop runs with the operating-system privileges of its user. SDK host code and custom tools are
trusted code and are outside managed built-in tool enforcement. Do not run Loop with elevated
privileges unless the task requires them.

Repository instructions, comments, skills, attachments, tool results and model output can contain
misleading or malicious instructions. Prompt formatting is not a security boundary. Review
untrusted repositories and install only trusted integrations.

MCP servers control their own execution and resource access; built-in file and Shell restrictions
do not sandbox them. Restricted sessions require approval or an exact live-session MCP tool grant;
full-access sessions allow MCP calls automatically. Provider and MCP service behavior remains
subject to those services' own security and data-handling policies. See
[MCP integration](packages/coding-agent/src/docs/mcp.md),
[skills](packages/coding-agent/src/docs/skills.md) and
[project context](packages/coding-agent/src/docs/context-files.md).

### Web and remote access

The desktop Web listener binds to IPv4 loopback and checks request Host, Origin and cross-site
metadata. It is a local single-user service, not a login-protected multi-user host. Local processes
are within the host trust boundary; loopback binding alone does not make browser content trusted.

Optional managed remote access uses a separate ingress with device pairing and authentication.
Pairing grants chat access across registered projects, including model and permission changes and
tool approvals. There are no per-project or read-only device roles. Pair only trusted devices and
revoke access when it is no longer needed. Authentication, request checks and remote route
restrictions remain security boundaries even when remote access is enabled. See
[Web server](packages/web-ui/src/backend/docs/server.md) and
[remote device pairing](packages/web-ui/src/backend/docs/remote-devices.md).

## Vulnerability scope

Reports are in scope when Loop crosses an implemented security boundary, including:

- Managed tool permission bypasses or additional execution authority without a valid approval.
- Restricted Shell execution falling back to unrestricted execution after sandbox failure.
- Web script injection, request-origin bypasses or unauthorized access to session files.
- Remote authentication, pairing, route-policy or device-revocation bypasses.
- Unintended disclosure of credentials or private data caused by Loop's implementation.
- Vulnerabilities in shipped dependencies with demonstrated reachability and impact through Loop.

The following do not, by themselves, establish a Loop vulnerability:

- Actions explicitly authorized by the user or trusted SDK host within the granted scope.
- An attacker modifying local state using access they already possess as the same operating-system
  user, unless Loop itself grants that access or crosses another security boundary.
- Malicious trusted custom tools or external services acting within their existing authority.
- Prompt injection or undesirable model output that does not bypass an implemented control.
- Risks introduced by deliberately granting full access or exposing the local service through an
  unsupported public proxy.

These exclusions do not apply when Loop itself causes the unauthorized access. In particular,
prompt injection that leads to a permission bypass or Web script execution remains in scope.

## Safe operation and sensitive data

Use the least permissive preset needed and review the actual operation scope before approving.
Use a dedicated account, container or virtual machine with an isolated filesystem when working
with untrusted code or when stronger isolation is required. Keep credentials outside writable
workspaces; this alone does not prevent managed tools from reading them.

Treat session history, configuration, attachments and tool output as sensitive local data. Review
what is sent to model providers and MCP services, and sanitize material before sharing it. Do not
commit API keys, tokens, private URLs, personal data, logs, caches or local database files. See
[contributor sensitive-data guidance](CONTRIBUTING.md#sensitive-data-before-a-pr).
