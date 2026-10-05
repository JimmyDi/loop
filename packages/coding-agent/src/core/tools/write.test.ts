import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { expect, test } from "vitest";

import { createWriteTool } from "./write";

test("write creates relative parent directories and observes cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-write-"));

  try {
    const tool = createWriteTool(dir, { permissionPreset: "workspace-write" });

    await tool.execute({ path: "nested/file.txt", content: "value" }, new AbortController().signal);
    expect(await readFile(join(dir, "nested/file.txt"), "utf8")).toBe("value");
    await expect(
      tool.execute({ path: "nested/file.txt", content: "changed" }, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(await readFile(join(dir, "nested/file.txt"), "utf8")).toBe("value");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
