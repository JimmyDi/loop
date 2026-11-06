import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { SessionManager } from "./session-manager";
import { validateBookmarks } from "./session-bookmarks";

test("bookmarks persist without changing messages or activity and survive later commits", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".bookmarks-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    const messages = [{ role: "user" as const, content: "Synthetic request", timestamp: 0 }];
    await manager.commit(messages);
    const updated = manager.getHeader().updatedAt;
    await Promise.all([
      manager.setBookmark(0, true),
      manager.setTitle({ text: "Title", source: "user", messageIndices: [] }),
    ]);
    expect(manager.getHeader().updatedAt).toBe(updated);
    expect(manager.messages).toEqual(messages);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().bookmarks).toEqual([0]);
    await manager.commit([...messages, { ...messages[0]!, timestamp: 1 }]);
    expect(manager.getHeader().bookmarks).toEqual([0]);
    await manager.setBookmark(0, false);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().bookmarks).toEqual([]);
    await expect(manager.setBookmark(99, true)).rejects.toThrow();
    expect(() => validateBookmarks([0, 0], messages)).toThrow();
    expect(() => validateBookmarks([-1], messages)).toThrow();
    expect(() => validateBookmarks([1], messages)).toThrow();
    expect(() => validateBookmarks(undefined, messages)).not.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
