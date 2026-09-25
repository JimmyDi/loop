import { expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { ProjectStore } from "./project-store";

test("canonical projects deduplicate concurrent additions and survive rename/remove", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".project-test-"));

  try {
    const cwd = join(root, "workspace");
    const alias = join(root, "alias");
    const file = join(root, "data", "projects.json");

    await mkdir(cwd);
    await symlink(cwd, alias);
    await Bun.write(join(cwd, "keep.txt"), "keep");

    const store = new ProjectStore(file);
    const [a, b] = await Promise.all([store.add(cwd), store.add(alias)]);

    expect(a.id).toBe(b.id);
    expect(await store.list()).toHaveLength(1);
    await store.rename(a.id, "Example");
    expect((await new ProjectStore(file).get(a.id)).name).toBe("Example");
    await store.remove(a.id);
    expect(await store.list()).toEqual([]);
    expect(await Bun.file(join(cwd, "keep.txt")).text()).toBe("keep");
    expect((await store.add(cwd)).cwd).toBe(a.cwd);
    await expect(store.add("relative")).rejects.toThrow("absolute_path_required");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("corrupt registry is reported without overwriting it", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".project-test-"));

  try {
    const file = join(root, "projects.json");

    await Bun.write(file, "{}");
    await expect(new ProjectStore(file).add(root)).rejects.toThrow("Invalid project registry");
    expect(await Bun.file(file).text()).toBe("{}");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unreadable projects stay registered and cannot be added until accessible", async () => {
  if (process.getuid?.() === 0) return;

  const root = await mkdtemp(join(import.meta.dir, ".project-test-"));
  const cwd = join(root, "workspace");

  try {
    await mkdir(cwd);
    const store = new ProjectStore(join(root, "projects.json"));
    const project = await store.add(cwd);

    await chmod(cwd, 0o000);
    expect((await store.get(project.id)).accessible).toBe(false);
    await expect(store.add(cwd)).rejects.toThrow();
    expect(await store.list()).toHaveLength(1);
    await chmod(cwd, 0o700);
    expect((await store.get(project.id)).accessible).toBe(true);
  } finally {
    await chmod(cwd, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
});
