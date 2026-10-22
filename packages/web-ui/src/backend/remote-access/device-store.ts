import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import type { RemoteDevice } from "../../shared/remote-devices";
import { HttpError } from "../http/errors";

export type DeviceRecord = RemoteDevice & { credentialHash: string };

const validRecord = (value: unknown): value is DeviceRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).sort().join() === "createdAt,credentialHash,expiresAt,id,name" &&
    typeof item.id === "string" &&
    /^[a-f0-9-]{36}$/.test(item.id) &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    item.name.length <= 80 &&
    typeof item.credentialHash === "string" &&
    /^[a-f0-9]{64}$/.test(item.credentialHash) &&
    Number.isSafeInteger(item.createdAt) &&
    Number.isSafeInteger(item.expiresAt) &&
    (item.expiresAt as number) > (item.createdAt as number)
  );
};

export class DeviceStore {
  constructor(private readonly file: string) {}

  async read(): Promise<DeviceRecord[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      const record = value as Record<string, unknown>;
      if (
        Object.keys(record).sort().join() !== "devices,version" ||
        record.version !== 1 ||
        !Array.isArray(record.devices) ||
        record.devices.length > 32 ||
        !record.devices.every(validRecord) ||
        new Set(record.devices.map((item) => item.id)).size !== record.devices.length ||
        new Set(record.devices.map((item) => item.credentialHash)).size !== record.devices.length
      )
        throw new Error();
      return record.devices;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new HttpError(503, "device_storage_failed");
    }
  }

  async save(devices: DeviceRecord[]): Promise<void> {
    const temporary = this.file + "." + randomUUID() + ".tmp";
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify({ version: 1, devices }) + "\n");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.file);
    } catch {
      throw new HttpError(503, "device_storage_failed");
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}
