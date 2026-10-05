import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { SettingsManager } from "./settings-manager";

test("settings load only supported defaults and reject malformed configuration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-settings-"));

  try {
    expect((await SettingsManager.create(dir)).defaultModel).toBeUndefined();
    await writeFile(join(dir, "settings.json"), JSON.stringify({ provider: "test", model: "one" }));
    expect((await SettingsManager.create(dir)).defaultModel).toEqual({
      provider: "test",
      id: "one",
    });
    await writeFile(join(dir, "settings.json"), JSON.stringify({ model: 2 }));
    await expect(SettingsManager.create(dir)).rejects.toThrow("provider and model");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("permission-only defaults are accepted and invalid presets reject", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".permission-settings-test-"));
  try {
    expect((await SettingsManager.create(root)).defaultPermissionPreset).toBe("read-only");
    await writeFile(
      join(root, "settings.json"),
      JSON.stringify({ permissionPreset: "workspace-write" }),
    );
    const settings = await SettingsManager.create(root);
    expect(settings.defaultModel).toBeUndefined();
    expect(settings.defaultPermissionPreset).toBe("workspace-write");
    await writeFile(join(root, "settings.json"), JSON.stringify({ permissionPreset: "unknown" }));
    await expect(SettingsManager.create(root)).rejects.toThrow("Invalid permission preset");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
