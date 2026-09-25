import type { Api, Model } from "@earendil-works/pi-ai";

import type { AgentSession } from "./agent-session";
import { SessionManager } from "./session-manager";

export type SessionFactory = (options: {
  cwd: string;
  sessionManager: SessionManager;
  model?: Model<Api>;
}) => Promise<{ session: AgentSession }>;

export class AgentSessionRuntime {
  private current: AgentSession;
  private changing = false;
  private disposed = false;
  private rebind?: (session: AgentSession) => void | Promise<void>;

  constructor(
    session: AgentSession,
    private readonly factory: SessionFactory,
  ) {
    this.current = session;
  }

  get session(): AgentSession {
    return this.current;
  }

  get cwd(): string {
    return this.current.sessionManager.getCwd();
  }

  setRebindSession(callback?: (session: AgentSession) => void | Promise<void>): void {
    this.rebind = callback;
  }

  newSession(): Promise<{ cancelled: false }> {
    return this.replace(async () => {
      const current = this.current.sessionManager;
      const sessionManager = current.sessionFile
        ? await SessionManager.create(this.cwd, current.getSessionDir())
        : SessionManager.inMemory(this.cwd);

      return this.factory({ cwd: this.cwd, sessionManager, model: this.current.model });
    });
  }

  switchSession(path: string): Promise<{ cancelled: false }> {
    return this.replace(async () => {
      const sessionManager = await SessionManager.open(path);

      return this.factory({ cwd: sessionManager.getCwd(), sessionManager });
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    if (this.changing) throw new Error("Session replacement is in progress");

    this.changing = true;

    try {
      await this.current.abort();
      this.current.dispose();
      this.disposed = true;
      this.rebind = undefined;
    } finally {
      this.changing = false;
    }
  }

  private async replace(
    prepare: () => Promise<{ session: AgentSession }>,
  ): Promise<{ cancelled: false }> {
    if (this.disposed) throw new Error("Runtime is disposed");

    if (this.changing) throw new Error("Session replacement is in progress");

    const release = this.current.reserve();
    const previous = this.current;

    this.changing = true;

    try {
      const { session } = await prepare();

      release();
      previous.dispose();
      this.current = session;

      const releaseNext = session.reserve();

      try {
        await this.rebind?.(session);
      } finally {
        releaseNext();
      }

      return { cancelled: false };
    } finally {
      release();
      this.changing = false;
    }
  }
}

export async function createAgentSessionRuntime(
  factory: SessionFactory,
  options: { cwd: string; sessionManager: SessionManager; model?: Model<Api> },
): Promise<AgentSessionRuntime> {
  const { session } = await factory(options);

  return new AgentSessionRuntime(session, factory);
}
