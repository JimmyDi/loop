import { constants } from "node:fs";
import { access, mkdir, realpath, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute } from "node:path";

import type { Project } from "../../shared/protocol";
import { HttpError } from "../http/errors";

export class ProjectStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<Project[]> {
    await this.tail;

    return Promise.all(
      (await this.read()).map(async (project) => ({
        ...project,
        accessible: await this.checkDirectory(project.cwd).then(
          () => true,
          () => false,
        ),
      })),
    );
  }

  async get(id: string): Promise<Project> {
    const project = (await this.list()).find((item) => item.id === id);

    if (!project) throw new HttpError(404, "project_not_found");

    return project;
  }

  add(path: string, name?: string): Promise<Project> {
    return this.mutate(async (projects) => {
      if (!isAbsolute(path)) throw new HttpError(400, "absolute_path_required");

      const cwd = await realpath(path);

      await this.checkDirectory(cwd);

      const existing = projects.find((project) => project.cwd === cwd);

      if (existing) return existing;

      const project = { id: crypto.randomUUID(), cwd, name: name?.trim() || basename(cwd) || cwd };

      projects.push(project);

      return project;
    });
  }

  rename(id: string, name: string): Promise<Project> {
    return this.mutate((projects) => {
      const project = projects.find((item) => item.id === id);

      if (!project) throw new HttpError(404, "project_not_found");

      if (!name.trim()) throw new HttpError(400, "invalid_name");

      project.name = name.trim();

      return project;
    });
  }

  remove(id: string): Promise<void> {
    return this.mutate((projects) => {
      const index = projects.findIndex((item) => item.id === id);

      if (index < 0) throw new HttpError(404, "project_not_found");

      projects.splice(index, 1);
    });
  }

  private async checkDirectory(cwd: string): Promise<void> {
    if (!(await stat(cwd)).isDirectory()) throw new HttpError(400, "directory_required");

    await access(cwd, constants.R_OK | constants.X_OK);
  }

  private async read(): Promise<Project[]> {
    if (!(await Bun.file(this.file).exists())) return [];

    const data: unknown = await Bun.file(this.file).json();

    if (
      !Array.isArray(data) ||
      data.some(
        (p) =>
          !p ||
          typeof p.id !== "string" ||
          typeof p.name !== "string" ||
          typeof p.cwd !== "string" ||
          !isAbsolute(p.cwd),
      )
    ) {
      throw new Error("Invalid project registry");
    }

    return data;
  }

  private mutate<T>(change: (projects: Project[]) => T | Promise<T>): Promise<T> {
    const operation = this.tail.then(async () => {
      const projects = await this.read();
      const value = await change(projects);
      const temporary = this.file + "." + crypto.randomUUID() + ".tmp";

      await mkdir(dirname(this.file), { recursive: true });

      try {
        await Bun.write(temporary, JSON.stringify(projects, null, 2) + "\n");
        await rename(temporary, this.file);
      } finally {
        await unlink(temporary).catch(() => {});
      }

      return value;
    });

    this.tail = operation.catch(() => {});

    return operation;
  }
}
