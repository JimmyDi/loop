import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SettingsManager } from "./settings-manager";

test("settings load only supported defaults and reject malformed configuration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-settings-"));

  try {
    expect((await SettingsManager.create(dir)).defaultModel).toBeUndefined();
    await Bun.write(join(dir, "settings.json"), JSON.stringify({ provider: "test", model: "one" }));
    expect((await SettingsManager.create(dir)).defaultModel).toEqual({
      provider: "test",
      id: "one",
    });
    await Bun.write(join(dir, "settings.json"), JSON.stringify({ model: 2 }));
    await expect(SettingsManager.create(dir)).rejects.toThrow("provider and model");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
