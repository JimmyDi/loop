import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { createProjectDraft } from "./create-project-draft";

test("matching draft configuration needs only the session creation request", async () => {
  const previous = globalThis.fetch;
  const snapshot: SessionSnapshot = {
    sessionId: "draft",
    workspaceId: "new",
    streamId: "stream",
    operation: "idle",
    tools: {},
    model: { provider: "example", id: "model", name: "Model" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      permissionPreset: "read-only",
    },
  };
  globalThis.fetch = vi.fn(async () => Response.json(snapshot)) as typeof fetch;
  try {
    expect(await createProjectDraft("new", snapshot)).toEqual(snapshot);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  } finally {
    globalThis.fetch = previous;
  }
});
