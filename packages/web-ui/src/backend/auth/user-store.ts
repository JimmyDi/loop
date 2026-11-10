import { randomUUID } from "node:crypto";

import type { Account } from "../../shared/accounts";
import { HttpError } from "../http/errors";
import { makePassword, verifyPassword } from "./password";
import type { PasswordRecord } from "./password";
import { readPrivateJson, writePrivateJson } from "./private-json";

type UserRecord = Account & { password: PasswordRecord };

const valid = (value: unknown): value is UserRecord => {
  const row = value as UserRecord | null;
  return (
    !!row &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.id) &&
    typeof row.username === "string" &&
    /^[a-z0-9_-]{1,32}$/.test(row.username) &&
    row.password?.algorithm === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(row.password.salt) &&
    /^[a-f0-9]{128}$/.test(row.password.hash)
  );
};

export const publicAccount = ({ id, username }: Account): Account => ({
  id,
  username,
});

export class UserStore {
  private users: UserRecord[] = [];
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async load(): Promise<void> {
    const data = await readPrivateJson(this.file);
    if (data === undefined) {
      await writePrivateJson(this.file, { version: 1, users: [] });
      return;
    }
    const record = data as { version: number; users: UserRecord[] };
    if (
      record?.version !== 1 ||
      !Array.isArray(record.users) ||
      !record.users.every(valid) ||
      new Set(record.users.map((row) => row.id)).size !== record.users.length ||
      new Set(record.users.map((row) => row.username)).size !== record.users.length
    )
      throw new Error("Invalid account storage");
    this.users = record.users;
  }

  get(id: string): Account {
    const user = this.users.find((row) => row.id === id);
    if (!user) throw new HttpError(401, "account_unauthorized");
    return publicAccount(user);
  }

  async verify(username: string, password: string): Promise<Account> {
    const record = this.users.find((row) => row.username === username.toLowerCase());
    // Unknown users incur the same password derivation as existing users.
    const fallback: PasswordRecord = {
      algorithm: "scrypt-v1",
      salt: "0".repeat(32),
      hash: "0".repeat(128),
    };
    const matches = await verifyPassword(password, record?.password ?? fallback);
    if (!record || !matches) throw new HttpError(401, "invalid_credentials");
    return publicAccount(record);
  }

  create(username: string, password: unknown): Promise<Account> {
    return this.mutate(async (users) => {
      const normalized = username.toLowerCase();
      if (!/^[a-z0-9_-]{1,32}$/.test(normalized)) throw new HttpError(400, "invalid_username");
      if (users.some((row) => row.username === normalized))
        throw new HttpError(409, "username_taken");
      const user: UserRecord = {
        id: randomUUID(),
        username: normalized,
        password: await makePassword(password),
      };
      users.push(user);
      return publicAccount(user);
    });
  }

  changePassword(id: string, password: unknown): Promise<Account> {
    return this.mutate(async (users) => {
      const user = users.find((row) => row.id === id);
      if (!user) throw new HttpError(404, "account_not_found");
      user.password = await makePassword(password);
      return publicAccount(user);
    });
  }

  private mutate<T>(change: (users: UserRecord[]) => Promise<T>): Promise<T> {
    const work = this.tail.then(async () => {
      const users = structuredClone(this.users);
      const result = await change(users);
      await writePrivateJson(this.file, { version: 1, users });
      this.users = users;
      return result;
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
