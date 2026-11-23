import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

import type { EchoData } from "../../shared/echo";
import { validateEchoData } from "./validation";

export class EchoStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(readonly directory: string) {}

  async read(): Promise<EchoData> {
    await this.tail;
    return this.readFile();
  }

  private async readFile(): Promise<EchoData> {
    try {
      const data = validateEchoData(
        JSON.parse(await readFile(join(this.directory, "echo.json"), "utf8")),
      );
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { version: 1, agents: [], conversations: [] };
      throw error;
    }
  }

  mutate<T>(action: (data: EchoData) => T | Promise<T>): Promise<T> {
    const work = this.tail.then(async () => {
      const data = await this.readFile();
      const result = await action(data);
      validateEchoData(data);
      await this.atomic("echo.json", JSON.stringify(data, null, 2));
      return result;
    });
    this.tail = work.catch(() => {});
    return work;
  }

  async token(): Promise<string> {
    try {
      return await readFile(join(this.directory, "connection.secret"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }

  saveToken(value: string): Promise<void> {
    return this.atomic("connection.secret", value);
  }

  private async atomic(name: string, content: string): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = join(this.directory, name);
    const temporary = file + "." + crypto.randomUUID() + ".tmp";
    try {
      await writeFile(temporary, content, { mode: 0o600, flag: "wx" });
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}
