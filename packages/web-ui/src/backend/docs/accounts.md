# Local accounts and profiles

Loop authenticates Web users locally, without a database or cloud identity service. Model requests, optional downloads and remote tunnels retain their own network requirements.

## Usage

Open the local Web URL and choose **Create account** or **Sign in**. The account screen adapts to light/dark themes and narrow displays, supports password visibility, and shows submission and error states inline. All accounts have equal permissions. Usernames contain 1–32 ASCII letters, digits, underscores or hyphens and are normalized to lowercase. Passwords contain 8–1024 characters. In **More → Account settings**, view your stable profile ID for CLI/SDK selection or change your own password by supplying the current password. A successful password change signs out every login and revokes paired devices. **More → Sign out** revokes only the current login.

There are no roles, privileged accounts, user listing, account disabling, third-party password resets, account deletion, password recovery or legacy-data migration. Registration remains available from the local login page after the first account is created. Users cannot read another user's chats through the Web API.

## Storage

```text
<dataDir>/
  auth/users.json
  auth/login-sessions.json
  users/<userId>/
    settings.json
    mcp.json
    skills/
    skills.json
    sessions/
    traces/
    web-ui/projects.json
    web-ui/provider.json
    web-ui/settings.json
    web-ui/remote-access/
  bin/devtunnel/
  voice/
```

The root defaults to `~/.loop`; `LOOP_DATA_DIR` overrides it. Each user has a separate registry, runtime, configuration, event subscriptions and history. Normal chat workspaces use the sibling `<dataDir-name>-workspaces/<userId>/<workspaceId>/`. External projects stay in place: users who select the same directory share its source files, while their session histories remain separate. Personal skills are discovered inside the profile, without importing the operating-system user's global `.agents` directory. Project skills remain shared with the external project.

Tools and voice components remain instance resources. Every locally authenticated account may install/remove shared Dev Tunnels CLI or voice components; changes affect the whole instance. Paired remote clients cannot manage these resources. Each account owns its remote tunnel metadata and paired devices; a paired device can access only its owner's profile. Native Dev Tunnels authentication may additionally use operating-system-managed credentials. This is separate from local account passwords.

## Authentication and API

Passwords use a random 16-byte salt and Node scrypt: N=32768, r=8, p=1, 64-byte output, recorded as `scrypt-v1`. Passwords are never stored as plaintext. A successful login issues a 32-byte random credential in an HttpOnly, SameSite=Strict, Path=/ cookie; HTTPS adds Secure. Only its SHA-256 hash is stored server-side. The absolute lifetime is 30 days, without sliding renewal. Normal restarts preserve unexpired logins.

| Endpoint | Contract |
| --- | --- |
| GET /api/auth/session | Current public account, or null |
| POST /api/auth/register | Create an equal local account and sign in; username/password |
| POST /api/auth/login | Sign in with username/password |
| POST /api/auth/logout | Revoke the current login and clear its cookie |
| POST /api/auth/password | Change the authenticated account’s password; currentPassword/password; signs out all its devices |

All business requests require authentication. Host and origin checks remain active; mutating local requests require the exact Origin. Login/registration attempts are limited to ten per minute per running instance. Cookies, client-supplied user IDs and private-worker identity headers are never accepted as a directory selector. The authenticated server selects the profile.

Logout closes that login's streams and voice connection. Password changes revoke all its logins and paired-device grants. Accepted text tasks continue in their original profile when a browser logs out or disconnects; another user cannot take over, cancel or approve them. Shutdown cancels running work through the existing session lifecycle.

Browser drafts and view preferences use user-scoped keys; query caches and session memory are cleared on account changes. Browser storage is not encrypted. API responses are not cached by the service worker.

## Lifecycle and limitations

One Web service owns a data root, enforced by `web-service.lock`. Normal shutdown removes the lock. After a crash, confirm the service is stopped before manually removing its stale lock. No automatic repair or recovery is provided. Authentication writes are serialized and use private temporary files, fsync and atomic replacement. Corrupt account/login files reject startup rather than enabling anonymous access.

Private profile directories use 0700 and auth files use 0600 on POSIX. Other credentials and conversation files are local data, not encrypted storage. The Web listener remains loopback-only. CLI/SDK profile selection is trusted local access, not password authentication. These controls do not isolate mutually untrusted operating-system users or unrestricted agent tools running under the same OS identity. Use operating-system isolation for that threat model.

Development keeps account authentication and per-user remote access in the gateway; the private worker receives authenticated profile identities and maintains independent registries. Backend restarts interrupt active work but do not reset local login cookies.

## Source and verification

- [Accounts](../auth/accounts.ts) and [tests](../auth/accounts.test.ts).
- [Request authentication](../auth/account-server.ts) and [isolation tests](../auth/account-server.test.ts).
- [Profile service](../profile-service.ts), [user runtime](../auth/user-runtime.ts), [worker](../startup/business-service.ts).
- [Account gate](../../frontend/components/accounts/AccountGate.tsx) and [tests](../../frontend/components/accounts/AccountGate.test.tsx).
- [SDK profiles](../../../../coding-agent/src/docs/profiles.md).
