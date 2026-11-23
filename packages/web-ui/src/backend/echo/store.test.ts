import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { EchoStore } from "./store";

test("Echo serializes writes, restores records and keeps credentials outside public data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-echo-"));
  try {
    const store = new EchoStore(dir);
    await Promise.all(
      ["one", "two"].map((id) =>
        store.mutate((data) =>
          data.agents.push({ id: crypto.randomUUID(), name: id, instructions: "" }),
        ),
      ),
    );
    await store.saveToken("synthetic-token");
    const restored = new EchoStore(dir);
    expect((await restored.read()).agents).toHaveLength(2);
    expect(JSON.stringify(await restored.read())).not.toContain("synthetic-token");
    expect(await restored.token()).toBe("synthetic-token");
    if (process.platform !== "win32")
      expect((await stat(join(dir, "connection.secret"))).mode & 0o777).toBe(0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
