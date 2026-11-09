import { join } from "node:path";

import { HttpError } from "../http/errors";
import { UserStore } from "./user-store";
import { LoginStore } from "./login-store";
import { validatePassword } from "./password";

export class Accounts {
  readonly users: UserStore;
  readonly logins: LoginStore;
  private tail: Promise<unknown> = Promise.resolve();
  private attempts: number[] = [];
  private readonly invalidations = new Set<(id: string) => void | Promise<void>>();
  private readonly changing = new Set<string>();
  private closing = false;

  constructor(dataDir: string) {
    this.users = new UserStore(join(dataDir, "auth", "users.json"));
    this.logins = new LoginStore(join(dataDir, "auth", "login-sessions.json"));
  }

  async load(): Promise<void> {
    await this.users.load();
    await this.logins.load();
  }

  authenticate(request: Request) {
    const login = this.logins.find(request);
    this.assertAvailable(login.userId);
    return { login, user: this.users.get(login.userId) };
  }

  assertAvailable(id: string): void {
    if (this.changing.has(id)) throw new HttpError(401, "account_unauthorized");
  }

  subscribe(listener: (id: string) => void | Promise<void>): () => void {
    this.invalidations.add(listener);
    return () => this.invalidations.delete(listener);
  }

  login(username: string, password: string, register = false) {
    this.attempts = this.attempts.filter((time) => time > Date.now() - 60_000);
    if (this.attempts.length >= 10) throw new HttpError(429, "login_rate_limited");
    this.attempts.push(Date.now());
    return this.serialize(async () => {
      const user = register
        ? await this.users.create(username, password)
        : await this.users.verify(username, password);
      return { user, token: await this.logins.create(user.id) };
    });
  }

  changePassword(request: Request, currentPassword: string, password: unknown) {
    return this.serialize(async () => {
      const { user } = this.authenticate(request);
      await this.users.verify(user.username, currentPassword);
      validatePassword(password);
      this.changing.add(user.id);
      try {
        await this.logins.revoke((row) => row.userId === user.id);
        await Promise.all([...this.invalidations].map((listener) => listener(user.id)));
        return await this.users.changePassword(user.id, password);
      } finally {
        this.changing.delete(user.id);
      }
    });
  }

  logout(request: Request): Promise<void> {
    return this.serialize(async () => {
      const { login } = this.authenticate(request);
      await this.logins.revoke((row) => row.hash === login.hash);
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.tail;
    this.logins.close();
  }

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new HttpError(503, "server_closing"));
    const work = this.tail.then(action);
    this.tail = work.catch(() => {});
    return work;
  }
}
