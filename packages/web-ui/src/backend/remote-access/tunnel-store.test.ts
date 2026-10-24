import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { TunnelStore } from "./tunnel-store";

test("stable identity and port survive restart in atomic private storage; corrupt state cannot change identity", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".tunnel-store-test-"));
  const file = join(root, "tunnel.json");
  const store = new TunnelStore(file);
  const record = {
    tunnelId: "synthetic.test",
    port: 1234,
    configured: true,
    origin: "https://synthetic-1234.test.devtunnels.ms",
  };
  try {
    expect(await store.read()).toBeUndefined();
    await store.save(record);
    expect(await new TunnelStore(file).read()).toEqual(record);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ version: 1, ...record });
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readdir(root)).toEqual(["tunnel.json"]);
    for (const content of [
      "invalid",
      "null",
      "[]",
      JSON.stringify({ version: 2, ...record }),
      JSON.stringify({ version: 1, ...record, port: 0 }),
      JSON.stringify({ version: 1, ...record, tunnelId: "--help" }),
      JSON.stringify({ version: 1, ...record, origin: "https://other.test" }),
    ]) {
      await writeFile(file, content);
      await expect(store.read()).rejects.toMatchObject({ code: "connection_state_failed" });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
