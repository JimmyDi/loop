import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import { RemoteAccessError } from "./errors";

export type TunnelRecord = { tunnelId: string; port: number; configured: boolean; origin?: string };

export const validTunnelId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,59}(?:[.][a-z0-9]{2,12})?$/.test(value);

export class TunnelStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async read(): Promise<TunnelRecord | undefined> {
    await this.tail;
    try {
      const value = JSON.parse(await readFile(this.file, "utf8"));
      if (
        !value ||
        !["configured,port,tunnelId,version", "configured,origin,port,tunnelId,version"].includes(
          Object.keys(value).sort().join(),
        ) ||
        value.version !== 1 ||
        !validTunnelId(value.tunnelId) ||
        !Number.isInteger(value.port) ||
        value.port < 1024 ||
        value.port > 65535 ||
        typeof value.configured !== "boolean" ||
        (value.origin !== undefined &&
          (typeof value.origin !== "string" ||
            !/^https:\/\/[a-z0-9-]+-[0-9]+[.][a-z0-9]+[.]devtunnels[.]ms$/.test(value.origin) ||
            !value.origin.endsWith(
              "-" + value.port + "." + value.tunnelId.split(".")[1] + ".devtunnels.ms",
            )))
      )
        throw new Error();
      return {
        tunnelId: value.tunnelId,
        port: value.port,
        configured: value.configured,
        ...(value.origin ? { origin: value.origin } : {}),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new RemoteAccessError("connection_state_failed");
    }
  }

  save(record: TunnelRecord): Promise<void> {
    const operation = this.tail.then(async () => {
      const temporary = this.file + "." + randomUUID() + ".tmp";
      try {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(JSON.stringify({ version: 1, ...record }) + "\n");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, this.file);
      } catch {
        throw new RemoteAccessError("connection_state_failed");
      } finally {
        await unlink(temporary).catch(() => {});
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
