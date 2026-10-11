import { expect, test } from "vitest";

import { readDraft, useQueueEdits, writeDraft } from "./queue-edit-store";
import { useWorkspace } from "./workspace-store";

test("queue edits retain session ownership and restore the previous complete draft", () => {
  const workspace = useWorkspace.getState();
  const edits = useQueueEdits.getState();
  try {
    const backup = {
      text: "draft",
      images: [],
      files: [{ name: "note.txt", text: "Keep" }],
      skills: [],
    };
    writeDraft("a", backup);
    useQueueEdits
      .getState()
      .begin("a", "queued", { text: "edit", images: [], files: [], skills: [] });
    useQueueEdits
      .getState()
      .begin("a", "other", { text: "other", images: [], files: [], skills: [] });
    expect(readDraft("a").text).toBe("edit");
    expect(useQueueEdits.getState().edits.a?.id).toBe("queued");
    expect(useQueueEdits.getState().edits.b).toBeUndefined();
    useQueueEdits.getState().finish("a");
    expect(readDraft("a")).toEqual(backup);
    expect(useQueueEdits.getState().edits.a).toBeUndefined();
  } finally {
    useWorkspace.setState(workspace, true);
    useQueueEdits.setState(edits, true);
  }
});
