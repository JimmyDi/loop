import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly fallback: T,
  ) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as T;
    } catch {
      return this.fallback;
    }
  }

  async write(value: T) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(value, null, 2) + "\n");
  }

  async update(mutator: (value: T) => T) {
    const next = mutator(await this.read());
    await this.write(next);
    return next;
  }
}
