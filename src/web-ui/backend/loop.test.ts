import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { SessionManager, getSessionDir } from "../../coding-agent/index";
import { createLoopBridge } from "./loop";

test("SDK bridge lists canonical project history without exposing file paths", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".bridge-test-"));

  try {
    const manager = await SessionManager.create(root, getSessionDir(root, root));
    const bridge = createLoopBridge(root);
    const sessions = await bridge.list({ id: "project", name: "Example", cwd: root });

    expect(sessions[0]?.id).toBe(manager.getSessionId());
    expect(sessions[0]?.workspaceId).toBe("project");
    expect(sessions[0]).not.toHaveProperty("path");
    await expect(
      bridge.load({ id: "project", name: "Example", cwd: root }, "unknown"),
    ).rejects.toThrow("Session not found");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
