import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { createEditTool } from "./edit";

test("edit matches original content, rejects ambiguity and coordinates writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-edit-"));
  const signal = new AbortController().signal;

  try {
    const path = join(dir, "file.txt");
    const tool = createEditTool(dir, { permissionPreset: "workspace-write" });

    await writeFile(path, "alpha beta gamma");
    await tool.execute(
      {
        path: "file.txt",
        edits: [
          { oldText: "alpha", newText: "beta" },
          { oldText: "beta", newText: "delta" },
        ],
      },
      signal,
    );
    expect(await readFile(path, "utf8")).toBe("beta delta gamma");
    await expect(
      tool.execute({ path, edits: [{ oldText: "missing", newText: "x" }] }, signal),
    ).rejects.toThrow();
    await expect(
      tool.execute(
        {
          path,
          edits: [
            { oldText: "beta delta", newText: "x" },
            { oldText: "delta", newText: "y" },
          ],
        },
        signal,
      ),
    ).rejects.toThrow("overlap");
    await Promise.all([
      tool.execute({ path, edits: [{ oldText: "beta", newText: "first" }] }, signal),
      tool.execute({ path, edits: [{ oldText: "gamma", newText: "last" }] }, signal),
    ]);
    expect(await readFile(path, "utf8")).toBe("first delta last");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
