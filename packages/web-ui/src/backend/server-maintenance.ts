import type { SessionController } from "./session-controller";
import { HttpError } from "./http/errors";

export type ServerActivity = { tasks: number; saving: boolean; requests: number };

export type ServerMaintenance = {
  status(): ServerActivity;
  prepare(stop: boolean): Promise<boolean>;
  resume(): void;
};

/** Serializes update preparation with every local and remote business request. */
export class MaintenanceCoordinator implements ServerMaintenance {
  private locked = false;
  private preparing = false;
  private requests = 0;

  constructor(
    private readonly sessions: () => Iterable<SessionController>,
    private readonly backgroundBusy: () => boolean,
    private readonly stopBackground: () => Promise<void>,
  ) {}

  get accepting(): boolean {
    return !this.locked;
  }

  status(): ServerActivity {
    const sessions = [...this.sessions()];
    return {
      tasks:
        sessions.filter(
          (item) =>
            item.snapshot.operation !== "idle" ||
            item.session.state.isRunning ||
            !!item.session.state.pendingApprovals?.length ||
            !!item.session.state.pendingUserInputs?.length,
        ).length + Number(this.backgroundBusy()),
      saving: sessions.some((item) => item.session.state.hasPendingSave),
      requests: this.requests,
    };
  }

  async request<T>(action: () => Promise<T>): Promise<T> {
    if (this.locked) throw new HttpError(503, "server_updating");
    this.requests++;
    try {
      return await action();
    } finally {
      this.requests--;
    }
  }

  async prepare(stop: boolean): Promise<boolean> {
    if (this.preparing || this.locked) throw new HttpError(409, "update_preparing");
    this.locked = true;
    this.preparing = true;
    try {
      const status = this.status();
      if (status.requests || (!stop && status.tasks)) {
        this.locked = false;
        return false;
      }
      const sessions = [...this.sessions()];
      if (stop) {
        const stopped = await Promise.allSettled([
          ...sessions.map((item) => item.abort()),
          this.stopBackground(),
        ]);
        if (stopped.some((result) => result.status === "rejected"))
          throw new Error("Tasks could not be stopped");
      }
      for (const item of sessions) {
        await item.session.cancelTitle();
        await item.session.flush();
        await item.session.flushTrace?.();
      }
      const final = this.status();
      if (final.tasks || final.saving || final.requests) throw new Error("Server is still busy");
      return true;
    } catch (error) {
      this.locked = false;
      throw error;
    } finally {
      this.preparing = false;
    }
  }

  resume(): void {
    if (this.preparing) throw new HttpError(409, "update_preparing");
    this.locked = false;
  }
}
