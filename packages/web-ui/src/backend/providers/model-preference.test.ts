import { join } from "node:path";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { ModelPreference } from "./model-preference";

test("model preference survives restart and ignores malformed or unavailable storage", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".preference-test-"));
  const path = join(root, "model.selection");
  try {
    const preference = new ModelPreference(path);
    await preference.load();
    expect(preference.value).toBeUndefined();
    const choice = { provider: "gateway", id: "example" };
    await preference.save(choice);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const restored = new ModelPreference(path);
    await restored.load();
    expect(restored.value).toEqual(choice);
    for (const invalid of ["invalid-json", "null", '{"id":42}', '{"provider":[],"id":"test"}']) {
      await writeFile(path, invalid);
      await restored.load();
      expect(restored.value).toBeUndefined();
    }
    await expect(new ModelPreference(join(path, "child")).save(choice)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
