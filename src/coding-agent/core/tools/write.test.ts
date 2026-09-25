import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createWriteTool } from "./write";

test("write creates relative parent directories and observes cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-write-"));

  try {
    const tool = createWriteTool(dir);

    await tool.execute({ path: "nested/file.txt", content: "value" }, new AbortController().signal);
    expect(await Bun.file(join(dir, "nested/file.txt")).text()).toBe("value");
    await expect(
      tool.execute({ path: "nested/file.txt", content: "changed" }, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(await Bun.file(join(dir, "nested/file.txt")).text()).toBe("value");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
