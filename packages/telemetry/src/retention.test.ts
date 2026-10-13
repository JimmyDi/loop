import { mkdtemp, rm, utimes, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";

import { pruneTraces } from "./retention";
import { TraceRecorder } from "./recorder";

test("retention removes expired inactive logs but preserves live writers", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-trace-retention-"));
  const workspace = "a".repeat(24);
  const oldPath = join(root, workspace, crypto.randomUUID());
  const livePath = join(root, workspace, crypto.randomUUID());
  const old = await TraceRecorder.open(oldPath, "synthetic-old");
  const live = await TraceRecorder.open(livePath, "synthetic-live");
  try {
    await old.close();
    const timestamp = new Date(Date.now() - 40 * 86400000);
    await utimes(join(oldPath, "manifest.json"), timestamp, timestamp);
    await utimes(join(livePath, "manifest.json"), timestamp, timestamp);
    await pruneTraces(root);
    await expect(access(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(livePath)).resolves.toBeUndefined();
    live.record({ type: "still-live" });
    await live.close();
  } finally {
    await old.close();
    await live.close();
    await rm(root, { recursive: true, force: true });
  }
});
