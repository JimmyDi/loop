import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { createAgentSessionServices } from "./agent-session-services";
import { getProfileDir } from "./profile";

test("SDK profileId resolves settings and storage below the selected user directory", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".profile-test-"));
  const id = "00000000-0000-4000-8000-000000000001";
  try {
    const profile = getProfileDir(id, root);
    await mkdir(profile, { recursive: true });
    await writeFile(
      join(profile, "settings.json"),
      JSON.stringify({ permissionPreset: "workspace-write" }),
    );
    const services = await createAgentSessionServices({
      cwd: root,
      agentDir: root,
      profileId: id,
      noContextFiles: true,
    });
    expect(services.agentDir).toBe(profile);
    expect(services.settingsManager.defaultPermissionPreset).toBe("workspace-write");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
