import { dirname } from "node:path";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";

import type { RemoteAccessErrorCode } from "../../shared/remote-access";
import { RemoteAccessError } from "./errors";

/** Serialized atomic storage for one versioned remote-access flag. */
export class BooleanStateStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly key: "signedIn" | "enabled",
    private readonly errorCode: RemoteAccessErrorCode,
  ) {}

  async read(): Promise<boolean> {
    await this.tail;
    try {
      const value: unknown = JSON.parse(await readFile(this.file, "utf8"));
      return (
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 2 &&
        "version" in value &&
        value.version === 1 &&
        this.key in value &&
        (value as Record<string, unknown>)[this.key] === true
      );
    } catch {
      return false;
    }
  }

  save(enabled: boolean): Promise<void> {
    const operation = this.tail.then(async () => {
      const temporary = this.file + "." + crypto.randomUUID() + ".tmp";
      try {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(JSON.stringify({ version: 1, [this.key]: enabled }) + "\n");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, this.file);
      } catch {
        throw new RemoteAccessError(this.errorCode);
      } finally {
        await unlink(temporary).catch(() => {});
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
