import type { Message } from "@earendil-works/pi-ai";
import { realpathSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { getSessionDir } from "../config";
import { atomicWrite } from "../utils/atomic-write";
import { validateMessages } from "./messages";
import { validateRunTimings } from "./run-timing";
import type { SessionRunTiming } from "./run-timing";
import { isModelEffort } from "./models/model-effort";
import { fallbackTitle, titleInputs, validTitle } from "./titles/title-text";
import type { SessionTitle } from "./titles/types";
import type { ModelSelection, SessionData, SessionHeader, SessionInfo } from "./types/storage";
import { isPermissionPreset } from "./permissions/types";
import type { PermissionPreset } from "./permissions/types";
import { validateRuntimeContexts } from "./runtime-context";
import type { RuntimeContextSnapshot } from "./runtime-context";

export class SessionManager {
  private pending?: SessionData;
  private writing = false;
  private writes: Promise<void> = Promise.resolve();

  private constructor(
    private data: SessionData,
    readonly sessionFile?: string,
    private draft = false,
    readonly restored = false,
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

  static draft(cwd: string, sessionDir = getSessionDir(cwd)): SessionManager {
    const memory = SessionManager.inMemory(cwd);
    return new SessionManager(
      memory.data,
      join(resolve(sessionDir), memory.data.header.id + ".jsonl"),
      true,
    );
  }

  static async open(path: string): Promise<SessionManager> {
    const lines = (await Bun.file(path).text()).trim().split("\n");
    const header = JSON.parse(lines.shift() ?? "") as SessionHeader;

    if (header?.format !== "loop-session" || (header.version !== 1 && header.version !== 2))
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
      (header.permissionPreset !== undefined && !isPermissionPreset(header.permissionPreset)) ||
      (header.version === 2 && !isPermissionPreset(header.permissionPreset)) ||
      (header.title !== undefined && !validTitle(header.title)) ||
      (header.model !== undefined &&
        (!header.model ||
          typeof header.model.provider !== "string" ||
          typeof header.model.id !== "string" ||
          (header.model.effort !== undefined && !isModelEffort(header.model.effort))))
    )
      throw new Error("Invalid session metadata");

    if (!(await stat(header.cwd)).isDirectory()) throw new Error("Session cwd is not a directory");

    const messages: unknown = lines.map((line) => JSON.parse(line));

    validateMessages(messages);
    validateRunTimings(header.runTimings, messages);
    validateRuntimeContexts(header.runtimeContexts, messages);

    return new SessionManager({ header, messages }, resolve(path), false, true);
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
          userMessageCount: manager.messages.filter((message) => message.role === "user").length,
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

  getRunTimings(): SessionRunTiming[] {
    return structuredClone((this.pending ?? this.data).header.runTimings ?? []);
  }

  getRuntimeContexts(): RuntimeContextSnapshot[] {
    return structuredClone((this.pending ?? this.data).header.runtimeContexts ?? []);
  }

  getHeader(): SessionHeader {
    const header = structuredClone(this.data.header);

    if (!header.title) {
      const first = titleInputs(this.data.messages)[0];

      if (first) header.title = fallbackTitle(first);
    }

    return header;
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

  async commit(
    messages: readonly Message[],
    runTimings: readonly SessionRunTiming[] = this.getRunTimings(),
    runtimeContexts: readonly RuntimeContextSnapshot[] = this.getRuntimeContexts(),
  ): Promise<void> {
    if (this.pending || this.writing) throw new Error("Pending session save; call flush first");
    validateRunTimings(runTimings, messages);
    validateRuntimeContexts(runtimeContexts, messages);

    this.pending = {
      header: {
        ...this.data.header,
        updatedAt: new Date().toISOString(),
        runTimings: runTimings.length ? structuredClone([...runTimings]) : undefined,
        runtimeContexts: runtimeContexts.length ? structuredClone([...runtimeContexts]) : undefined,
      },
      messages: structuredClone([...messages]),
    };
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.writing) throw new Error("Session save is already running");

    if (!this.pending) return;

    this.writing = true;

    try {
      await this.serialize(async () => {
        validateMessages(this.pending!.messages);
        await this.write(this.pending!);
        this.data = this.pending!;
        this.pending = undefined;
      });
    } finally {
      this.writing = false;
    }
  }

  async setModel(model: ModelSelection): Promise<void> {
    if (model.effort !== undefined && !isModelEffort(model.effort))
      throw new Error("Invalid model effort");
    if (this.pending || this.writing) throw new Error("Pending session save");

    this.writing = true;

    try {
      await this.serialize(async () => {
        const next = {
          ...this.data,
          header: {
            ...this.data.header,
            model: {
              provider: model.provider,
              id: model.id,
              ...(model.effort && model.effort !== "default" ? { effort: model.effort } : {}),
            },
            updatedAt: new Date().toISOString(),
          },
        };

        await this.write(next);
        this.data = next;
      });
    } finally {
      this.writing = false;
    }
  }

  async setPermissionPreset(permissionPreset: PermissionPreset): Promise<void> {
    if (!isPermissionPreset(permissionPreset)) throw new Error("Invalid permission preset");
    if (this.pending || this.writing) throw new Error("Pending session save");
    this.writing = true;
    try {
      await this.serialize(async () => {
        const next: SessionData = {
          ...this.data,
          header: {
            ...this.data.header,
            version: 2,
            permissionPreset,
            updatedAt: new Date().toISOString(),
          },
        };
        await this.write(next);
        this.data = next;
      });
    } finally {
      this.writing = false;
    }
  }

  async setTitle(title: SessionTitle, accept: () => boolean = () => true): Promise<boolean> {
    if (!validTitle(title)) throw new Error("Invalid session title");
    const value = structuredClone(title);
    return this.serialize(async () => {
      if (!accept()) return false;
      const previous = this.data;
      const next = { ...previous, header: { ...previous.header, title: value } };
      await this.write(next);
      if (!accept()) {
        await this.write(previous);
        return false;
      }
      this.data = next;
      if (this.pending) this.pending.header.title = structuredClone(value);
      return true;
    });
  }

  async waitForWrites(): Promise<void> {
    await this.writes;
  }

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const work = this.writes.then(action);
    this.writes = work.then(
      () => {},
      () => {},
    );
    return work;
  }

  private async write(data: SessionData): Promise<void> {
    if (this.draft && !data.messages.some((message) => message.role === "user")) return;
    if (this.sessionFile)
      await atomicWrite(
        this.sessionFile,
        [data.header, ...data.messages].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      );
    this.draft = false;
  }
}
