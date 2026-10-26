import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { patchSource } from "./source-patch";

test("patches reviewed source context and preserves unrelated content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-source-patch-"));
  try {
    const file = join(directory, "CMakeLists.txt");
    await writeFile(file, "project(synthetic)\nset(OPTION ON)\n# retained\n");
    await patchSource(file, "set(OPTION ON)", "set(OPTION OFF)");
    expect(await readFile(file, "utf8")).toBe("project(synthetic)\nset(OPTION OFF)\n# retained\n");
    await expect(patchSource(file, "set(OPTION ON)", "set(OPTION OFF)")).rejects.toThrow(
      "patch context changed",
    );
    expect(await readFile(file, "utf8")).toBe("project(synthetic)\nset(OPTION OFF)\n# retained\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
