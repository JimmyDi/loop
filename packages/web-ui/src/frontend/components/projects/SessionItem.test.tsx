import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionItem } from "./SessionItem";
import { useWorkspace } from "../../state/workspace-store";

test("row archives immediately; context menu preserves selection and only delete asks for confirmation", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const calls: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push([url, init?.method, init?.body ? JSON.parse(String(init.body)) : undefined]);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const session = {
    id: "s",
    workspaceId: "p",
    title: "Example",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 1,
    userMessageCount: 1,
  };
  try {
    useWorkspace.setState({ active: { id: "other", workspaceId: "p" } });
    const ui = render(
      <QueryClientProvider client={client}>
        <ul>
          <SessionItem session={session} />
        </ul>
      </QueryClientProvider>,
    );
    const row = ui.getByTitle("Example");
    fireEvent.contextMenu(row, { clientX: 200, clientY: 300 });
    expect(ui.getAllByRole("menuitem")).toHaveLength(4);
    expect(useWorkspace.getState().active?.id).toBe("other");
    fireEvent.click(ui.getByRole("menuitem", { name: "Rename" }));
    expect(ui.getByRole("textbox")).toBeTruthy();
    expect(ui.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(ui.getByRole("textbox"), { key: "Escape" });
    const open = ui.getByTitle("Example");
    fireEvent.keyDown(open, { key: "F10", shiftKey: true });
    fireEvent.click(ui.getByRole("menuitem", { name: "Permanently delete" }));
    expect(ui.getByRole("dialog", { name: "Delete chat?" })).toBeTruthy();
    expect(calls).toEqual([]);
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(calls).toEqual([]);
    fireEvent.click(ui.getByRole("button", { name: "Archive Example" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual(["/api/workspaces/p/archive", "POST", { ids: ["s"], archived: true }]);
    expect(ui.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(
        (ui.getByRole("button", { name: "Archive Example" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.contextMenu(ui.getByTitle("Example"));
    fireEvent.click(ui.getByRole("menuitem", { name: "Permanently delete" }));
    expect(calls).toHaveLength(1);
    fireEvent.click(ui.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual(["/api/workspaces/p/sessions/s", "DELETE", undefined]);
    await waitFor(() => expect(ui.queryByRole("dialog")).toBeNull());
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("delete failures stay in the confirmation and are cleared when it closes or reopens", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const calls: string[] = [];
  globalThis.fetch = (async (_url, init) => {
    calls.push(String(init?.method));
    return Response.json({ code: "project_busy" }, { status: 409 });
  }) as typeof fetch;
  const session = {
    id: "s",
    workspaceId: "p",
    title: "Example",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 1,
    userMessageCount: 1,
  };
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <ul>
          <SessionItem session={session} />
        </ul>
      </QueryClientProvider>,
    );
    fireEvent.click(ui.getByRole("button", { name: "Archive Example" }));
    await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
    expect(calls).toEqual(["POST"]);
    for (const close of ["Cancel", "Close"]) {
      fireEvent.contextMenu(ui.getByTitle("Example"));
      fireEvent.click(ui.getByRole("menuitem", { name: "Permanently delete" }));
      expect(ui.queryByRole("alert")).toBeNull();
      fireEvent.click(ui.getByRole("button", { name: "Delete" }));
      await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
      const dialog = ui.getByRole("dialog", { name: "Delete chat?" });
      expect(dialog.contains(ui.getByRole("alert"))).toBe(true);
      expect(ui.getByRole("alert").textContent).toContain("deleting chats");
      expect(ui.container.querySelector(".session-item .error-notice")).toBeNull();
      fireEvent.click(ui.getByRole("button", { name: close }));
      expect(ui.queryByRole("dialog")).toBeNull();
      expect(ui.queryByRole("alert")).toBeNull();
      expect(ui.getByTitle("Example")).toBeTruthy();
    }
    expect(calls).toEqual(["POST", "DELETE", "DELETE"]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
