import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { loadResources } from "./resource-loader";

test("instructions load parent-first, honor per-directory priority and can be disabled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-resources-"));
  const nested = join(dir, "nested");

  try {
    await mkdir(nested);
    await writeFile(join(dir, "AGENTS.md"), "PARENT_INSTRUCTION");
    await writeFile(join(nested, "AGENTS.md"), "IGNORED_INSTRUCTION");
    await writeFile(join(nested, "AGENTS.override.md"), "CHILD_INSTRUCTION");

    const prompt = await loadResources(nested, { systemPrompt: "CUSTOM_BASE" });

    expect(prompt).toContain("CUSTOM_BASE");
    expect(prompt).toContain("<project_context>");
    expect(prompt).toContain('<project_instructions path="' + join(dir, "AGENTS.md") + '">');
    expect(prompt.indexOf("PARENT_INSTRUCTION")).toBeLessThan(prompt.indexOf("CHILD_INSTRUCTION"));
    expect(prompt).not.toContain("IGNORED_INSTRUCTION");
    expect(await loadResources(nested, { noContextFiles: true })).not.toContain(
      "PARENT_INSTRUCTION",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
