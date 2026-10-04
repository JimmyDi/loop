import { expect, test } from "bun:test";
import { link, mkdir, mkdtemp, readdir, rm, stat, symlink } from "node:fs/promises";
import { join } from "node:path";

import { createEditTool } from "../tools/edit";
import { createWriteTool } from "../tools/write";

test("file tools reject before side effects and replace hard links without modifying outside files", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".write-policy-test-"));
  const work = join(root, "work");
  await mkdir(work);
  const signal = new AbortController().signal;
  const outside = join(root, "outside");
  await Bun.write(outside, "original");
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
    expect(await Bun.file(outside).text()).toBe("original");
    expect((await stat(join(work, "hard"))).ino).not.toBe((await stat(outside)).ino);
    for (const tool of [createWriteTool(work), createEditTool(work)]) {
      await expect(
        tool.execute(
          { path: "hard", content: "x", edits: [{ oldText: "changed", newText: "x" }] },
          signal,
        ),
      ).rejects.toThrow("read-only");
    }
    expect(await Bun.file(join(work, "hard")).text()).toBe("changed");
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
    expect(await Bun.file(outside).text()).toBe("explicit");
    expect((await readdir(work)).some((name) => name.endsWith(".tmp"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
