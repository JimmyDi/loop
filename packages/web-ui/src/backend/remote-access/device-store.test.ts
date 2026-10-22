import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { credentialHash, newCredential } from "./device-credentials";
import { DeviceStore } from "./device-store";

test("device storage persists only hashes with private file permissions and fails closed", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".device-store-"));
  try {
    const file = join(root, "devices.json");
    const store = new DeviceStore(file);
    expect(await store.read()).toEqual([]);
    const credential = newCredential();
    const record = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Example phone",
      createdAt: 1,
      expiresAt: 2,
      credentialHash: credentialHash(credential),
    };
    await store.save([record]);
    expect(await new DeviceStore(file).read()).toEqual([record]);
    expect(await readFile(file, "utf8")).not.toContain(credential);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    for (const value of [
      "broken",
      JSON.stringify({ version: 1, devices: [record, record] }),
      JSON.stringify({ version: 2, devices: [] }),
      JSON.stringify({ version: 1, devices: [{ ...record, credential: "synthetic" }] }),
    ]) {
      await writeFile(file, value);
      await expect(store.read()).rejects.toMatchObject({ code: "device_storage_failed" });
    }
    await expect(new DeviceStore(root).save([])).rejects.toMatchObject({
      code: "device_storage_failed",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
