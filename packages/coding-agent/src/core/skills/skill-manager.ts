import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { realpath, rename, rm, lstat, mkdir } from "node:fs/promises";

import { discoverSkills, projectSkillRoots } from "./discovery";
import { readSkill, renderLoadedSkill } from "./skill-file";
import { listSkillResources } from "./resources";
import { readSkillSettings, writeSkillSettings } from "./settings-store";
import { SkillInstaller } from "./installer";
import { SkillError } from "./types";
import type { SkillCatalog, SkillSummary, LoadedSkill, SkillSettings, SkillScope } from "./types";

export class SkillManager {
  readonly installer = new SkillInstaller();
  private catalogs = new Map<string, SkillCatalog>();
  private scans = new Map<string, Promise<void>>();
  private timer: ReturnType<typeof setInterval>;
  private mutation: Promise<void> = Promise.resolve();
  private transaction: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    readonly agentDir: string,
    private readonly agentsDir = join(homedir(), ".agents"),
  ) {
    this.timer = setInterval(() => {
      for (const cwd of this.catalogs.keys()) void this.refresh(cwd);
    }, 3000);
    this.timer.unref();
  }

  view(cwd: string): SkillCatalog {
    cwd = resolve(cwd);
    if (!this.catalogs.has(cwd)) {
      this.catalogs.set(cwd, { skills: [], discovering: true });
      void this.refresh(cwd);
    }
    return structuredClone(this.catalogs.get(cwd)!);
  }

  async refresh(cwd: string): Promise<void> {
    cwd = resolve(cwd);
    if (this.closed) return;
    const pending = this.scans.get(cwd);
    if (pending) return pending;
    const previous = this.catalogs.get(cwd) ?? { skills: [], discovering: true };
    this.catalogs.set(cwd, { ...previous, discovering: true });
    const work = (async () => {
      try {
        const settings = await readSkillSettings(join(this.agentDir, "skills.json"));
        const skills = await discoverSkills(cwd, this.agentDir, this.agentsDir, settings);
        this.catalogs.set(cwd, { skills, discovering: false });
      } catch (error) {
        this.catalogs.set(cwd, {
          ...previous,
          discovering: false,
          error: error instanceof Error ? error.message : "Skill discovery failed",
        });
      } finally {
        this.scans.delete(cwd);
      }
    })();
    this.scans.set(cwd, work);
    await work;
    if (this.catalogs.size > 32) {
      const oldest = this.catalogs.keys().next().value;
      if (oldest && oldest !== cwd) this.catalogs.delete(oldest);
    }
  }

  async load(
    cwd: string,
    handle: string,
    signal?: AbortSignal,
    explicit = false,
  ): Promise<LoadedSkill> {
    signal?.throwIfAborted();
    const row = await this.find(cwd, handle);
    if (!row.enabled || row.error || (!explicit && !row.modelInvocable))
      throw new SkillError("skill_unavailable", "The selected skill is disabled or unavailable.");
    const settings = await readSkillSettings(join(this.agentDir, "skills.json"));
    if (settings.disabled.includes(row.id)) throw new SkillError("skill_unavailable");
    const current = await realpath(row.path);
    if (current !== row.path) throw new SkillError("skill_source_changed");
    const body = await readSkill(row.path, signal);
    if (body.name !== row.name || (!explicit && !body.modelInvocable))
      throw new SkillError(
        "skill_source_changed",
        "Skill metadata changed; refresh before loading.",
      );
    return {
      id: row.id,
      name: body.name,
      description: body.description,
      path: row.path,
      content: renderLoadedSkill({ name: body.name, path: row.path, content: body.content }),
      revision: body.revision,
    };
  }

  async detail(cwd: string, id: string) {
    const row = await this.find(cwd, id);
    const body = await readSkill(row.path);
    return { ...row, content: body.content, files: await listSkillResources(row.path) };
  }

  async toggle(cwd: string, id: string, enabled: boolean): Promise<void> {
    const row = await this.find(cwd, id);
    await this.editSettings((settings) => {
      settings.disabled = settings.disabled.filter((value) => value !== row.id);
      if (!enabled) settings.disabled.push(row.id);
    });
    await this.refreshAll();
  }

  install(
    cwd: string,
    job: string,
    keys: string[],
    scope: SkillScope,
    updateId?: string,
  ): Promise<void> {
    return this.transact(() => this.installPrepared(cwd, job, keys, scope, updateId));
  }

  private async installPrepared(
    cwd: string,
    job: string,
    keys: string[],
    scope: SkillScope,
    updateId?: string,
  ): Promise<void> {
    const previous = updateId ? await this.find(cwd, updateId) : undefined;
    if (previous && (!previous.managed || previous.scope !== scope))
      throw new SkillError("skill_not_managed");
    await mkdir(this.agentDir, { recursive: true, mode: 0o700 });
    const base = scope === "personal" ? await realpath(this.agentDir) : await realpath(cwd);
    const previousDirectory = previous ? await this.ownedDirectory(cwd, previous) : undefined;
    await this.installer.install(
      job,
      keys,
      scope,
      previousDirectory
        ? dirname(previousDirectory)
        : join(base, ...(scope === "personal" ? ["skills"] : [".agents", "skills"])),
      (paths) =>
        this.editSettings((settings) => {
          for (const row of paths) settings.installations[row.path] = row.source;
        }),
      previousDirectory,
    );
    await this.refreshAll();
  }

  async previewUpdate(cwd: string, id: string) {
    const row = await this.find(cwd, id);
    if (!row.managed || row.source.kind !== "github")
      throw new SkillError("skill_update_unavailable");
    const location =
      row.source.location +
      "/tree/" +
      encodeURIComponent(row.source.ref ?? "main") +
      (row.source.subdirectory ? "/" + row.source.subdirectory : "");
    return this.installer.preview({ kind: "github", location, ref: row.source.ref });
  }

  remove(cwd: string, id: string): Promise<void> {
    return this.transact(() => this.removeInstalled(cwd, id));
  }

  private async removeInstalled(cwd: string, id: string): Promise<void> {
    const row = await this.find(cwd, id);
    if (!row.managed)
      throw new SkillError("skill_not_managed", "Disable externally managed skills instead.");
    const directory = await this.ownedDirectory(cwd, row);
    if ((await lstat(directory)).isSymbolicLink() || (await realpath(directory)) !== directory)
      throw new SkillError("skill_source_changed");
    const staging = join(dirname(directory), ".uninstall-" + crypto.randomUUID());
    await rename(directory, staging);
    try {
      await this.editSettings((settings) => {
        delete settings.installations[row.path];
        settings.disabled = settings.disabled.filter((value) => value !== row.id);
      });
    } catch (error) {
      await rename(staging, directory);
      throw error;
    }
    await rm(staging, { recursive: true, force: true });
    await this.refreshAll();
  }

  async close(): Promise<void> {
    this.closed = true;
    clearInterval(this.timer);
    await this.installer.close();
    await Promise.allSettled([...this.scans.values(), this.mutation, this.transaction]);
  }

  private async find(cwd: string, id: string): Promise<SkillSummary> {
    if (this.closed) throw new SkillError("skill_manager_closed");
    const row = this.view(cwd).skills.find((skill) => skill.id === id || skill.handle === id);
    if (row) return row;
    await this.refresh(cwd);
    const found = this.view(cwd).skills.find((skill) => skill.id === id || skill.handle === id);
    if (!found) throw new SkillError("skill_unknown", "Skill is unknown or no longer available.");
    return found;
  }

  private editSettings(edit: (settings: SkillSettings) => void): Promise<void> {
    const work = this.mutation
      .catch(() => {})
      .then(async () => {
        const file = join(this.agentDir, "skills.json");
        const settings = await readSkillSettings(file);
        edit(settings);
        await writeSkillSettings(file, settings);
      });
    this.mutation = work;
    return work;
  }

  private transact(work: () => Promise<void>): Promise<void> {
    if (this.closed) return Promise.reject(new SkillError("skill_manager_closed"));
    const next = this.transaction.catch(() => {}).then(work);
    this.transaction = next;
    return next;
  }

  private async ownedDirectory(cwd: string, row: SkillSummary): Promise<string> {
    const directory = dirname(row.path);
    const roots =
      row.scope === "personal"
        ? [join(await realpath(this.agentDir), "skills")]
        : await projectSkillRoots(cwd);
    if (!roots.includes(dirname(directory)) || row.path !== join(directory, "SKILL.md"))
      throw new SkillError("skill_not_managed");
    return directory;
  }

  private async refreshAll(): Promise<void> {
    await Promise.all([...this.scans.values()]);
    await Promise.all([...this.catalogs.keys()].map((cwd) => this.refresh(cwd)));
  }
}
