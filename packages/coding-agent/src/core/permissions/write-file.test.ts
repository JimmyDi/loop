import { join } from "node:path";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { expect, test } from "vitest";

import { createEditTool } from "../tools/edit";
import { createWriteTool } from "../tools/write";

test("file tools reject before side effects and replace hard links without modifying outside files", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".write-policy-test-"));
  const work = join(root, "work");
  await mkdir(work);
  const signal = new AbortController().signal;
  const outside = join(root, "outside");
  await writeFile(outside, "original");
  await symlink(outside, join(work, "link"));
  await link(outside, join(work, "hard"));
  try {
    const write = createWriteTool(work, { permissionPreset: "workspace-write" });
    const edit = createEditTool(work, { permissionPreset: "workspace-write" });
    await expect(
      write.execute({ path: "../missing/deep/file", content: "x" }, signal),
    ).rejects.toThrow("outside");
    expect((await readdir(root)).includes("missing")).toBe(false);
    await expect(write.execute({ path: "link", content: "x" }, signal)).rejects.toThrow("outside");
    await expect(
      edit.execute({ path: "link", edits: [{ oldText: "original", newText: "x" }] }, signal),
    ).rejects.toThrow("outside");
    await write.execute({ path: "hard", content: "changed" }, signal);
    expect(await readFile(outside, "utf8")).toBe("original");
    expect((await stat(join(work, "hard"))).ino).not.toBe((await stat(outside)).ino);
    for (const tool of [createWriteTool(work), createEditTool(work)]) {
      await expect(
        tool.execute(
          { path: "hard", content: "x", edits: [{ oldText: "changed", newText: "x" }] },
          signal,
        ),
      ).rejects.toThrow("read-only");
    }
    expect(await readFile(join(work, "hard"), "utf8")).toBe("changed");
    expect(() =>
      write.execute(
        { path: "new", content: "x", sandbox_permissions: "danger-full-access" },
        signal,
      ),
    ).toThrow("escalation");
    await createWriteTool(work, { permissionPreset: "danger-full-access" }).execute(
      { path: outside, content: "explicit" },
      signal,
    );
    expect(await readFile(outside, "utf8")).toBe("explicit");
    expect((await readdir(work)).some((name) => name.endsWith(".tmp"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
