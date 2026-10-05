import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ArchivedChatGroup } from "./ArchivedChatGroup";
import type { ArchivedChat } from "../../hooks/useArchivedChats";

test("group shows timestamps and count with isolated restore and delete actions", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const sessions: ArchivedChat[] = ["a", "b"].map((id) => ({
    id,
    workspaceId: "p",
    projectName: "Example",
    title: "Chat " + id,
    createdAt: "2026-09-01T08:30:00Z",
    updatedAt: "2026-09-01T08:30:00Z",
    messageCount: 2,
    userMessageCount: 1,
  }));
  const removed: string[][] = [];
  const restored: string[] = [];
  try {
    const ui = render(
      <ArchivedChatGroup
        name="Example"
        sessions={sessions}
        pending={false}
        onOpen={() => {}}
        onRestore={(session) => restored.push(session.id)}
        onDelete={(items) => removed.push(items.map((item) => item.id))}
        onDeleteProject={() => removed.push(sessions.map((item) => item.id))}
      />,
    );
    expect(ui.getByText("2 chats")).toBeTruthy();
    expect(ui.container.querySelectorAll("time")).toHaveLength(2);
    fireEvent.click(ui.getByRole("button", { name: "Restore Chat a" }));
    expect(restored).toEqual(["a"]);
    fireEvent.click(ui.getByRole("button", { name: "Delete Chat b" }));
    expect(removed).toEqual([["b"]]);
    fireEvent.click(ui.getByRole("button", { name: "Options for Example" }));
    fireEvent.click(ui.getByRole("menuitem", { name: "Delete all in project" }));
    expect(removed).toEqual([["b"], ["a", "b"]]);
    expect(ui.queryByRole("menu")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
