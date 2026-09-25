import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEditTool } from "./edit";

test("edit matches original content, rejects ambiguity and coordinates writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-edit-"));
  const signal = new AbortController().signal;

  try {
    const path = join(dir, "file.txt");
    const tool = createEditTool(dir);

    await Bun.write(path, "alpha beta gamma");
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
    expect(await Bun.file(path).text()).toBe("beta delta gamma");
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
    expect(await Bun.file(path).text()).toBe("first delta last");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
