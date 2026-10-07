import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { expect, test, vi } from "vitest";

import { SkillManager } from "./skill-manager";

test("background discovery keeps duplicate sources, isolates bad metadata and rechecks loads", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-skills-"));
  const project = join(root, "project");
  const personal = join(root, "personal");
  const shared = join(root, "shared");
  const manager = new SkillManager(personal, shared);
  const content = "---\nname: example\ndescription: Review source\n---\nOriginal instruction.";
  try {
    expect(manager.view(personal)).toMatchObject({ discovering: true });
    await manager.refresh(personal);
    expect(manager.view(personal)).toEqual({ skills: [], discovering: false });
    for (const directory of [
      join(project, ".agents/skills/example"),
      join(personal, "skills/example"),
      join(shared, "skills/explicit"),
    ]) {
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "SKILL.md"),
        directory.endsWith("explicit")
          ? content.replace("description:", "disable-model-invocation: true\ndescription:")
          : content,
      );
    }
    await mkdir(join(project, ".git"));
    await mkdir(join(project, "nested"));
    await mkdir(join(personal, "skills/broken"));
    await writeFile(join(personal, "skills/broken/SKILL.md"), "invalid");
    await symlink(join(personal, "skills/example"), join(shared, "skills/alias"));
    await manager.refresh(join(project, "nested"));
    const skills = manager.view(join(project, "nested")).skills;
    expect(skills).toHaveLength(4);
    expect(new Set(skills.map((skill) => skill.id)).size).toBe(4);
    expect(skills.find((skill) => skill.name === "broken")?.error).toBeTruthy();
    const manual = skills.find((skill) => !skill.modelInvocable && !skill.error)!;
    await expect(manager.load(join(project, "nested"), manual.handle)).rejects.toThrow(
      "unavailable",
    );
    const loaded = await manager.load(join(project, "nested"), manual.id, undefined, true);
    expect(loaded.description).toBe("Review source");
    await writeFile(manual.path, content.replace("Original", "Updated"));
    expect(
      (await manager.load(join(project, "nested"), manual.id, undefined, true)).revision,
    ).not.toBe(loaded.revision);
    expect(loaded.content).toContain("Original");
    await manager.toggle(join(project, "nested"), manual.id, false);
    await expect(manager.load(join(project, "nested"), manual.id, undefined, true)).rejects.toThrow(
      "unavailable",
    );
    await expect(manager.remove(join(project, "nested"), manual.id)).rejects.toThrow("externally");
    expect(await readFile(manual.path, "utf8")).toContain("Updated");
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("installs project resources without executing them and removes only managed folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-skill-install-"));
  const manager = new SkillManager(join(root, "personal"), join(root, "shared"));
  const source = join(root, "source");
  try {
    await mkdir(join(source, "scripts"), { recursive: true });
    await writeFile(
      join(source, "SKILL.md"),
      "---\nname: example\ndescription: Review source\n---\nRun scripts only when needed.",
    );
    await writeFile(join(source, "scripts/check.sh"), "exit 42\n", { mode: 0o700 });
    manager.view(root);
    const job = manager.installer.preview({ kind: "local", location: source });
    await vi.waitFor(() => expect(manager.installer.get(job.id).status).toBe("ready"));
    await manager.install(root, job.id, ["local"], "project");
    const skill = manager.view(root).skills[0]!;
    expect(skill).toMatchObject({ managed: true, scope: "project" });
    expect(await readFile(join(root, ".agents/skills/example/scripts/check.sh"), "utf8")).toBe(
      "exit 42\n",
    );
    await manager.remove(root, skill.id);
    expect(manager.view(root).skills).toEqual([]);
    expect(await readFile(join(source, "SKILL.md"), "utf8")).toContain("Review source");
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});
