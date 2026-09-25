import type { Project, SessionSummary } from "../shared/protocol";
import { HttpError } from "./http/errors";
import type { LoopBridge } from "./loop";
import type { ProjectStore } from "./projects/project-store";
import { SessionController } from "./session-controller";

export class SessionRegistry {
  private instances = new Map<string, SessionController>();
  private loading = new Map<string, Promise<SessionController>>();
  private owners = new Map<string, string>();
  private pending = new Map<string, number>();
  private removing = new Set<string>();
  private removed = new Set<string>();
  private closing = false;
  private configuring = false;
  private operations = new Set<Promise<unknown>>();

  constructor(
    readonly projects: ProjectStore,
    readonly loop: LoopBridge,
  ) {}

  async list(workspaceId: string): Promise<SessionSummary[]> {
    const project = await this.projects.get(workspaceId);
    const records = await this.loop.list(project);

    for (const record of records) this.owners.set(record.id, workspaceId);

    return records;
  }

  async create(workspaceId: string): Promise<SessionController> {
    return this.withProject(workspaceId, async (project) => {
      const session = await this.loop.load(project);
      const controller = new SessionController(session, workspaceId);

      this.instances.set(session.sessionId, controller);
      this.owners.set(session.sessionId, workspaceId);

      return controller;
    });
  }

  async get(id: string): Promise<SessionController> {
    if (this.closing) throw new HttpError(503, "server_closing");

    let owner = this.owners.get(id);

    if (!owner) {
      for (const project of await this.projects.list()) {
        if (project.accessible) await this.list(project.id);

        owner = this.owners.get(id);

        if (owner) break;
      }
    }

    if (!owner) throw new HttpError(404, "session_not_found");

    this.assertAvailable(owner);
    await this.projects.get(owner);
    this.assertAvailable(owner);

    const existing = this.instances.get(id);

    if (existing) return existing;

    const loading = this.loading.get(id);

    if (loading) return loading;

    const workspaceId = owner;
    const promise = this.withProject(workspaceId, async (project) => {
      const session = await this.loop.load(project, id);
      const controller = new SessionController(session, workspaceId);

      this.instances.set(id, controller);

      return controller;
    }).finally(() => this.loading.delete(id));

    this.loading.set(id, promise);

    return promise;
  }

  assertAvailable(workspaceId: string): void {
    if (this.closing) throw new HttpError(503, "server_closing");

    if (this.configuring) throw new HttpError(409, "provider_busy");

    if (this.removed.has(workspaceId)) throw new HttpError(404, "project_not_found");

    if (this.removing.has(workspaceId)) throw new HttpError(409, "project_busy");
  }

  async remove(workspaceId: string): Promise<void> {
    this.assertAvailable(workspaceId);
    this.removing.add(workspaceId);

    try {
      const sessions = [...this.instances.values()].filter(
        (item) => item.workspaceId === workspaceId,
      );

      if (this.pending.get(workspaceId) || sessions.some((item) => item.busy)) {
        throw new HttpError(409, "project_busy");
      }

      await this.projects.remove(workspaceId);
      this.removed.add(workspaceId);

      for (const item of sessions) {
        item.dispose();
        this.instances.delete(item.session.sessionId);
      }

      for (const [id, owner] of this.owners) {
        if (owner === workspaceId) this.owners.delete(id);
      }
    } finally {
      this.removing.delete(workspaceId);
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    await Promise.allSettled(this.operations);
    const results = await Promise.allSettled(
      [...this.instances.values()].map((item) => item.close()),
    );
    const failures = results.filter((item) => item.status === "rejected");

    if (failures.length)
      throw new AggregateError(
        failures.map((item) => item.reason),
        "Session save failed",
      );
  }

  async configure(action: () => Promise<void>): Promise<void> {
    this.assertAvailable("");

    if (
      this.operations.size ||
      this.removing.size ||
      [...this.instances.values()].some((item) => item.busy)
    )
      throw new HttpError(409, "provider_busy");

    this.configuring = true;
    const work = Promise.resolve().then(action);

    this.operations.add(work);

    try {
      await work;
    } finally {
      this.configuring = false;
      this.operations.delete(work);
    }
  }

  private withProject<T>(id: string, operation: (project: Project) => Promise<T>): Promise<T> {
    this.assertAvailable(id);
    this.pending.set(id, (this.pending.get(id) ?? 0) + 1);

    const work = this.projects
      .get(id)
      .then(operation)
      .finally(() => {
        this.pending.set(id, this.pending.get(id)! - 1);
        this.operations.delete(work);
      });

    this.operations.add(work);

    return work;
  }
}
