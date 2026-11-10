import { createHash, randomBytes } from "node:crypto";

import { HttpError } from "../http/errors";
import { onExpiry } from "../http/expiry";
import { readPrivateJson, writePrivateJson } from "./private-json";

export type Login = { hash: string; userId: string; createdAt: number; expiresAt: number };

export const loginLifetime = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class LoginStore {
  private logins: Login[] = [];
  private readonly connections = new Map<string, Set<AbortController>>();
  private readonly invalidations = new Set<(login: Login) => Promise<void>>();

  constructor(private readonly file: string) {}

  subscribe(listener: (login: Login) => Promise<void>): void {
    this.invalidations.add(listener);
  }

  async load(): Promise<void> {
    const data = await readPrivateJson(this.file);
    if (data === undefined) {
      await writePrivateJson(this.file, { version: 1, logins: [] });
      return;
    }
    const record = data as { version: number; logins: Login[] };
    if (
      record?.version !== 1 ||
      !Array.isArray(record.logins) ||
      !record.logins.every(
        (row) =>
          row &&
          /^[a-f0-9]{64}$/.test(row.hash) &&
          typeof row.userId === "string" &&
          Number.isSafeInteger(row.createdAt) &&
          Number.isSafeInteger(row.expiresAt) &&
          row.expiresAt > row.createdAt,
      ) ||
      new Set(record.logins.map((row) => row.hash)).size !== record.logins.length
    )
      throw new Error("Invalid login storage");
    this.logins = record.logins.filter((row) => row.expiresAt > Date.now());
  }

  find(request: Request): Login {
    const cookies =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .filter((part) => part.startsWith("loop_login=")) ?? [];
    const token = cookies.length === 1 ? cookies[0]!.slice(11) : "";
    const login = /^[a-f0-9]{64}$/.test(token)
      ? this.logins.find((row) => row.hash === hashToken(token) && row.expiresAt > Date.now())
      : undefined;
    if (!login) throw new HttpError(401, "account_unauthorized");
    return login;
  }

  get(hash: string): Login {
    const login = this.logins.find((row) => row.hash === hash && row.expiresAt > Date.now());
    if (!login) throw new HttpError(401, "account_unauthorized");
    return login;
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const next = [
      ...this.logins.filter((row) => row.expiresAt > Date.now()),
      {
        hash: hashToken(token),
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + loginLifetime,
      },
    ];
    await writePrivateJson(this.file, { version: 1, logins: next });
    this.logins = next;
    return token;
  }

  async revoke(match: (login: Login) => boolean): Promise<void> {
    const removed = this.logins.filter(match);
    const next = this.logins.filter((row) => !match(row));
    await writePrivateJson(this.file, { version: 1, logins: next });
    this.logins = next;
    for (const row of removed) {
      for (const abort of this.connections.get(row.hash) ?? []) abort.abort();
      this.connections.delete(row.hash);
      await Promise.allSettled([...this.invalidations].map((listener) => listener(row)));
    }
  }

  track(login: Login, abort: AbortController): () => void {
    const group = this.connections.get(login.hash) ?? new Set<AbortController>();
    group.add(abort);
    this.connections.set(login.hash, group);
    if (!this.logins.includes(login)) abort.abort();
    const cancelExpiry = onExpiry(login.expiresAt, () => abort.abort());
    return () => {
      cancelExpiry();
      group.delete(abort);
      if (!group.size) this.connections.delete(login.hash);
    };
  }

  close(): void {
    for (const group of this.connections.values()) for (const abort of group) abort.abort();
    this.connections.clear();
  }
}

export const loginCookie = (request: Request, token: string): string =>
  "loop_login=" +
  token +
  "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" +
  (token ? loginLifetime / 1000 : 0) +
  (new URL(request.url).protocol === "https:" ? "; Secure" : "");
