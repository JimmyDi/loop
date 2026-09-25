import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createReadTool } from "./read";

test("read honors line ranges and truncates long output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-read-"));

  try {
    await Bun.write(join(dir, "file.txt"), "one\ntwo\nthree");

    const tool = createReadTool(dir);

    expect(
      await tool.execute({ path: "file.txt", offset: 2, limit: 1 }, new AbortController().signal),
    ).toEqual([{ type: "text", text: "two" }]);
    await expect(
      tool.execute({ path: "file.txt", offset: 5 }, new AbortController().signal),
    ).rejects.toThrow("beyond");
    await Bun.write(join(dir, "file.txt"), "line\n".repeat(3000));
    expect(
      JSON.stringify(await tool.execute({ path: "file.txt" }, new AbortController().signal)),
    ).toContain("truncated");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
