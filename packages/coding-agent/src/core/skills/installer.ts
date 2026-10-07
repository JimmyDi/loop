import { access, mkdir, mkdtemp, rename, rm, realpath, lstat } from "node:fs/promises";
import { join } from "node:path";

import { readLocalBundle, createBundle, writeBundle } from "./bundle";
import type { SkillBundle } from "./bundle";
import { readGitHubBundles } from "./github-source";
import { SkillError } from "./types";
import type { SkillJob, SkillPreviewInput, SkillSource, SkillScope } from "./types";

type PreparedJob = {
  view: SkillJob;
  controller: AbortController;
  bundles: SkillBundle[];
  source?: SkillSource;
  expires: number;
};

export class SkillInstaller {
  private jobs = new Map<string, PreparedJob>();
  private closed = false;
  private operations = new Set<Promise<void>>();
  private transaction: Promise<void> = Promise.resolve();

  preview(input: SkillPreviewInput): SkillJob {
    if (this.closed) throw new SkillError("skill_manager_closed");
    for (const [id, job] of this.jobs)
      if (job.expires < Date.now() && job.view.status !== "running") this.jobs.delete(id);
    if (this.jobs.size >= 8)
      throw new SkillError("skill_installs_busy", "Close or cancel another installation first.");
    const job: PreparedJob = {
      view: {
        id: crypto.randomUUID(),
        status: "running",
        stage: input.kind === "github" ? "downloading" : "checking",
      },
      controller: new AbortController(),
      bundles: [],
      expires: Date.now() + 10 * 60_000,
    };
    this.jobs.set(job.view.id, job);
    const work = this.prepare(job, input).finally(() => this.operations.delete(work));
    this.operations.add(work);
    return structuredClone(job.view);
  }

  get(id: string): SkillJob {
    return structuredClone(this.require(id).view);
  }

  cancel(id: string): void {
    const job = this.require(id);
    job.controller.abort();
    job.view.status = "cancelled";
    job.bundles = [];
    if (job.view.stage !== "installing") this.jobs.delete(id);
  }

  install(
    id: string,
    keys: string[],
    scope: SkillScope,
    root: string,
    record: (paths: Array<{ path: string; source: SkillSource }>) => Promise<void>,
    replace?: string,
  ): Promise<void> {
    if (this.closed) return Promise.reject(new SkillError("skill_manager_closed"));
    const work = this.transaction
      .catch(() => {})
      .then(() => this.commit(id, keys, scope, root, record, replace));
    this.transaction = work;
    this.operations.add(work);
    void work.finally(() => this.operations.delete(work)).catch(() => {});
    return work;
  }

  private async commit(
    id: string,
    keys: string[],
    scope: SkillScope,
    root: string,
    record: (paths: Array<{ path: string; source: SkillSource }>) => Promise<void>,
    replace?: string,
  ): Promise<void> {
    const job = this.require(id);
    if (job.view.status !== "ready" || !keys.length || new Set(keys).size !== keys.length)
      throw new SkillError("skill_preview_not_ready");
    const bundles = keys.map((key) => job.bundles.find((bundle) => bundle.candidate.key === key));
    if (
      bundles.some((bundle) => !bundle) ||
      new Set(bundles.map((bundle) => bundle!.candidate.name)).size !== keys.length
    )
      throw new SkillError("skill_selection_invalid");
    job.view.status = "running";
    job.view.stage = "installing";
    const installed: string[] = [];
    let backup: { original: string; path: string } | undefined;
    let staging: string | undefined;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const canonical = await realpath(root);
      if ((await lstat(root)).isSymbolicLink() || canonical !== root)
        throw new SkillError(
          "skill_install_path_changed",
          "The installation directory contains a symbolic link.",
        );
      staging = await mkdtemp(join(root, ".install-"));
      const paths: Array<{ path: string; source: SkillSource }> = [];
      for (const bundle of bundles as SkillBundle[]) {
        job.controller.signal.throwIfAborted();
        const destination = join(root, bundle.candidate.name);
        if (replace && (keys.length !== 1 || destination !== replace))
          throw new SkillError("skill_update_name_changed");
        if (
          !replace &&
          (await access(destination).then(
            () => true,
            () => false,
          ))
        )
          throw new SkillError(
            "skill_already_installed",
            "A skill with this folder name already exists.",
          );
        const prepared = join(staging, bundle.candidate.name);
        await writeBundle(prepared, bundle, job.controller.signal);
        if (replace) {
          if (
            (await lstat(destination)).isSymbolicLink() ||
            (await realpath(destination)) !== destination
          )
            throw new SkillError("skill_source_changed");
          backup = { original: destination, path: join(staging, "backup") };
          await rename(destination, backup.path);
        }
        await rename(prepared, destination);
        installed.push(destination);
        paths.push({
          path: await realpath(join(destination, "SKILL.md")),
          source: {
            ...job.source!,
            subdirectory:
              bundle.candidate.key === "local" ||
              bundle.candidate.key === "created" ||
              bundle.candidate.key === "root"
                ? undefined
                : bundle.candidate.key.replace(/\/$/, ""),
          },
        });
      }
      job.controller.signal.throwIfAborted();
      await record(paths);
      job.view.status = "ready";
      this.jobs.delete(id);
    } catch (error) {
      for (const path of installed) await rm(path, { recursive: true, force: true });
      if (backup) await rename(backup.path, backup.original);
      job.view.status = job.controller.signal.aborted ? "cancelled" : "error";
      job.view.error = error instanceof Error ? error.message : "Installation failed";
      throw error;
    } finally {
      if (staging) await rm(staging, { recursive: true, force: true });
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const job of this.jobs.values()) job.controller.abort();
    await Promise.allSettled(this.operations);
    this.jobs.clear();
  }

  private require(id: string): PreparedJob {
    const job = this.jobs.get(id);
    if (!job || job.expires < Date.now())
      throw new SkillError("skill_preview_expired", "Preview expired; check the source again.");
    return job;
  }

  private async prepare(job: PreparedJob, input: SkillPreviewInput): Promise<void> {
    try {
      const signal = AbortSignal.any([job.controller.signal, AbortSignal.timeout(120_000)]);
      if (input.kind === "github") {
        const result = await readGitHubBundles(input, signal);
        job.bundles = result.bundles;
        job.source = result.source;
      } else if (input.kind === "local") {
        job.bundles = [await readLocalBundle(input.location ?? "", signal)];
        job.source = { kind: "local", location: input.location };
      } else {
        job.bundles = [
          createBundle("created", new Map([["SKILL.md", Buffer.from(input.content ?? "")]])),
        ];
        job.source = { kind: "created" };
      }
      signal.throwIfAborted();
      job.view.stage = "checking";
      job.view.candidates = job.bundles.map((bundle) => bundle.candidate);
      job.view.source = job.source;
      job.view.status = "ready";
    } catch (error) {
      job.view.status = job.controller.signal.aborted ? "cancelled" : "error";
      job.view.error = error instanceof Error ? error.message : "Preview failed";
      job.bundles = [];
    }
  }
}
