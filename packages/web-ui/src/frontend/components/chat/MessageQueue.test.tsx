import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { MessageQueue } from "./MessageQueue";
import type { SessionSnapshot } from "../../../shared/protocol";

test("paused queue retains items and status while resume belongs to the composer", () => {
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "session",
    workspaceId: "workspace",
    operation: "idle",
    model: { provider: "test", id: "test", name: "Test" },
    tools: {},
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "cancelled",
      listenerErrors: [],
      canResume: true,
      queue: [
        { id: "a", content: "first", skills: [], steering: false },
        { id: "b", content: "second", skills: [], steering: false },
      ],
    },
  };
  const html = renderToStaticMarkup(
    <MessageQueue snapshot={snapshot} disabled={false} onEdit={() => {}} />,
  );
  expect(html.indexOf("first")).toBeLessThan(html.indexOf("second"));
  expect(html).toContain("Paused — queued messages are retained");
  expect(html).not.toContain("Resume");
  expect(html).toContain("Steer");
  expect(html).toContain("Delete");
  expect(html).toContain('draggable="true"');
});

test("editing sends the same item ID; drag, keyboard move, steer and delete use atomic commands", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ accepted: true });
  }) as typeof fetch;
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "session",
    workspaceId: "workspace",
    operation: "prompt",
    model: { provider: "test", id: "test", name: "Test" },
    tools: {},
    state: {
      messages: [],
      isRunning: true,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      queue: [
        { id: "a", content: "first", skills: [], steering: false },
        { id: "b", content: "second", skills: [], steering: false },
      ],
    },
  };
  try {
    const edits: string[] = [];
    const ui = render(
      <MessageQueue snapshot={snapshot} disabled={false} onEdit={(id) => edits.push(id)} />,
    );
    expect(ui.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    fireEvent.click(ui.getAllByRole("button", { name: "More message options" })[0]!);
    await act(async () => fireEvent.click(ui.getByRole("menuitem", { name: "Edit" })));
    expect(edits).toEqual(["a"]);
    expect(ui.queryByRole("textbox")).toBeNull();
    const handles = ui.getAllByRole("button", { name: "Drag to reorder; use Up/Down keys" });
    await act(async () => fireEvent.keyDown(handles[1]!, { key: "ArrowUp" }));
    expect(bodies.pop()).toEqual({ id: "b", action: "move", beforeId: "a" });
    fireEvent.dragStart(handles[1]!);
    fireEvent(
      ui.getByRole("list"),
      new globalThis.window.MouseEvent("dragover", { bubbles: true, clientY: -1 }),
    );
    await act(async () => fireEvent.drop(ui.getAllByRole("listitem")[0]!));
    expect(bodies.pop()).toEqual({ id: "b", action: "move", beforeId: "a" });
    await act(async () => fireEvent.click(ui.getAllByRole("button", { name: "Steer" })[1]!));
    expect(bodies.pop()).toEqual({ id: "b", action: "steer" });
    await act(async () => fireEvent.click(ui.getAllByRole("button", { name: "Delete" })[0]!));
    expect(bodies.pop()).toEqual({ id: "a", action: "delete" });
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("active composer editing hides only its queue row", () => {
  const snapshot: SessionSnapshot = {
    streamId: "s",
    sessionId: "s",
    workspaceId: "p",
    operation: "idle",
    model: { id: "test", name: "Test", provider: "test" },
    tools: {},
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      queue: [
        { id: "a", content: "editing", skills: [], steering: false, editing: true },
        { id: "b", content: "later", skills: [], steering: false },
      ],
    },
  };
  const html = renderToStaticMarkup(
    <MessageQueue snapshot={snapshot} disabled={false} editingId="a" onEdit={() => {}} />,
  );
  expect(html).not.toContain("editing");
  expect(html).toContain("later");
});
