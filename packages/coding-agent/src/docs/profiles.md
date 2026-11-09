# Local user profiles

A profile selects an independent settings, session, trace and personal-resource directory. Web accounts map stable UUID user IDs to `<dataDir>/users/<userId>`. Local CLI and SDK callers can select the same data space without Web cookies. This is trusted filesystem access, not user authentication.

## Usage

Obtain the user ID from Web account settings and pass it to the CLI:

```bash
loop --profile <user-id>
```

For the SDK, pass `profileId` to `createAgentSession`. `agentDir` selects the instance root before the profile suffix is added.

```typescript
import { getProfileDir } from "@loop/coding-agent";

const userId = "00000000-0000-4000-8000-000000000001";
const profileDirectory = getProfileDir(userId);
```

## API and lifecycle

- `getProfileDir(userId, dataDir?)` validates a version-4 UUID and returns its profile path without creating files.
- `createAgentSession({ profileId, agentDir?, ...options })` resolves profile settings and default session/trace storage.
- `--profile USER_ID` selects the same root for CLI settings, sessions and traces.
- Without profile selection, existing explicit/default CLI and SDK directories remain available for trusted local use.
- Explicit SessionManager, settingsManager, MCP and Skill manager instances remain host-owned overrides. Hosts must not share those instances between users unless intentional.

Changing a username does not change the profile path. Profile selection does not consult the Web account registry or verify passwords. Filesystem ownership and permissions govern the local caller. No automatic old-data migration or profile recovery is provided.

## Limits and related files

External working directories are not copied: two profiles may share project source files. Profile directories do not sandbox arbitrary tools or encrypt secrets.

See [settings](settings.md), [sessions](sessions.md), [SDK](sdk.md), [profile source](../core/profile.ts), [tests](../core/profile.test.ts) and [SDK service tests](../core/agent-session-services.test.ts).
