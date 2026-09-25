import type { Message } from "@earendil-works/pi-ai";
import { realpathSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { getSessionDir } from "../config";
import { atomicWrite } from "../utils/atomic-write";
import { validateMessages } from "./messages";
import type { ModelSelection, SessionData, SessionHeader, SessionInfo } from "./types/storage";

export class SessionManager {
  private pending?: SessionData;
  private writing = false;

  private constructor(
    private data: SessionData,
    readonly sessionFile?: string,
  ) {}

  static inMemory(cwd = process.cwd()): SessionManager {
    const now = new Date().toISOString();

    return new SessionManager({
      header: {
        format: "loop-session",
        version: 1,
        id: crypto.randomUUID(),
        cwd: realpathSync(cwd),
        createdAt: now,
        updatedAt: now,
      },
      messages: [],
    });
  }

  static async create(cwd: string, sessionDir = getSessionDir(cwd)): Promise<SessionManager> {
    if (!(await stat(cwd)).isDirectory()) throw new Error("Session cwd is not a directory");

    const memory = SessionManager.inMemory(cwd);
    const manager = new SessionManager(
      memory.data,
      join(resolve(sessionDir), memory.data.header.id + ".jsonl"),
    );

    await manager.write(manager.data);

    return manager;
  }

  static async open(path: string): Promise<SessionManager> {
    const lines = (await Bun.file(path).text()).trim().split("\n");
    const header = JSON.parse(lines.shift() ?? "") as SessionHeader;

    if (header?.format !== "loop-session" || header.version !== 1)
      throw new Error("Unsupported session format or version");

    if (
      typeof header.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(header.id) ||
      typeof header.cwd !== "string" ||
      !isAbsolute(header.cwd) ||
      typeof header.createdAt !== "string" ||
      typeof header.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(header.createdAt)) ||
      !Number.isFinite(Date.parse(header.updatedAt)) ||
      (header.model !== undefined &&
        (!header.model ||
          typeof header.model.provider !== "string" ||
          typeof header.model.id !== "string"))
    )
      throw new Error("Invalid session metadata");

    if (!(await stat(header.cwd)).isDirectory()) throw new Error("Session cwd is not a directory");

    const messages: unknown = lines.map((line) => JSON.parse(line));

    validateMessages(messages);

    return new SessionManager({ header, messages }, resolve(path));
  }

  static async list(cwd: string, sessionDir = getSessionDir(cwd)): Promise<SessionInfo[]> {
    let names: string[];

    try {
      names = await readdir(sessionDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];

      throw error;
    }

    const sessions: SessionInfo[] = [];

    for (const name of names.filter((name) => name.endsWith(".jsonl"))) {
      const manager = await SessionManager.open(join(sessionDir, name));
      const header = manager.getHeader();

      if (realpathSync(header.cwd) === realpathSync(cwd))
        sessions.push({
          ...header,
          path: manager.sessionFile!,
          messageCount: manager.messages.length,
        });
    }

    return sessions.sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
    );
  }

  static async continueRecent(
    cwd: string,
    sessionDir = getSessionDir(cwd),
  ): Promise<SessionManager> {
    const recent = (await SessionManager.list(cwd, sessionDir))[0];

    return recent ? SessionManager.open(recent.path) : SessionManager.create(cwd, sessionDir);
  }

  get messages(): Message[] {
    return structuredClone((this.pending ?? this.data).messages);
  }

  get hasPendingSave(): boolean {
    return this.pending !== undefined;
  }

  getHeader(): SessionHeader {
    return structuredClone(this.data.header);
  }

  getCwd(): string {
    return realpathSync(this.data.header.cwd);
  }

  getSessionId(): string {
    return this.data.header.id;
  }

  getSessionFile(): string | undefined {
    return this.sessionFile;
  }

  getSessionDir(): string | undefined {
    return this.sessionFile ? dirname(this.sessionFile) : undefined;
  }

  async commit(messages: readonly Message[]): Promise<void> {
    if (this.pending || this.writing) throw new Error("Pending session save; call flush first");

    this.pending = {
      header: { ...this.data.header, updatedAt: new Date().toISOString() },
      messages: structuredClone([...messages]),
    };
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.writing) throw new Error("Session save is already running");

    if (!this.pending) return;

    this.writing = true;

    try {
      validateMessages(this.pending.messages);
      await this.write(this.pending);
      this.data = this.pending;
      this.pending = undefined;
    } finally {
      this.writing = false;
    }
  }

  async setModel(model: ModelSelection): Promise<void> {
    if (this.pending || this.writing) throw new Error("Pending session save");

    this.writing = true;

    try {
      const next = {
        ...this.data,
        header: {
          ...this.data.header,
          model: { provider: model.provider, id: model.id },
          updatedAt: new Date().toISOString(),
        },
      };

      await this.write(next);
      this.data = next;
    } finally {
      this.writing = false;
    }
  }

  private async write(data: SessionData): Promise<void> {
    if (this.sessionFile)
      await atomicWrite(
        this.sessionFile,
        [data.header, ...data.messages].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      );
  }
}
