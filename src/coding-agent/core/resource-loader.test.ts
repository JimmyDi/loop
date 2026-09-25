import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadResources } from "./resource-loader";

test("instructions load parent-first, honor per-directory priority and can be disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-resources-"));
  const nested = join(dir, "nested");

  try {
    await mkdir(nested);
    await Bun.write(join(dir, "AGENTS.md"), "PARENT_INSTRUCTION");
    await Bun.write(join(nested, "AGENTS.md"), "IGNORED_INSTRUCTION");
    await Bun.write(join(nested, "AGENTS.override.md"), "CHILD_INSTRUCTION");

    const prompt = await loadResources(nested, { systemPrompt: "CUSTOM_BASE" });

    expect(prompt).toContain("CUSTOM_BASE");
    expect(prompt.indexOf("PARENT_INSTRUCTION")).toBeLessThan(prompt.indexOf("CHILD_INSTRUCTION"));
    expect(prompt).not.toContain("IGNORED_INSTRUCTION");
    expect(await loadResources(nested, { noContextFiles: true })).not.toContain(
      "PARENT_INSTRUCTION",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
