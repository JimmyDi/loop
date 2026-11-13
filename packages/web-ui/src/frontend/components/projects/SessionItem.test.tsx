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
  const { render, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react/pure");
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
    expect(ui.getAllByRole("menuitem")).toHaveLength(5);
    expect(useWorkspace.getState().active?.id).toBe("other");
    fireEvent.click(ui.getByRole("menuitem", { name: "Reveal" }));
    await waitFor(() => expect(calls).toEqual([["/api/sessions/s/reveal", "POST", undefined]]));
    await waitFor(() =>
      expect(
        (ui.getByRole("button", { name: "Archive Example" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    calls.length = 0;
    expect(useWorkspace.getState().active?.id).toBe("other");
    fireEvent.contextMenu(row);
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
    await act(async () => {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
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
  const { render, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react/pure");
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
    await act(async () => {
      cleanup();
      client.clear();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("question waits show Needs input from summaries and clear when the live session settles", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, act, cleanup } = await import("@testing-library/react/pure");
  const { useSessions } = await import("../../state/session-store");
  const sessions = useSessions.getState();
  const client = new QueryClient();
  const session = {
    id: "needs-input",
    workspaceId: "project",
    title: "Choose a strategy",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    messageCount: 1,
    userMessageCount: 1,
    isGenerating: true,
    isWaitingForUserInput: true,
  };
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <ul>
          <SessionItem session={session} />
        </ul>
      </QueryClientProvider>,
    );
    expect(ui.getByRole("status", { name: "Needs input" }).textContent).toBe("Needs input");
    expect(ui.queryByRole("img", { name: "Looping..." })).toBeNull();
    expect(ui.container.querySelector(".session-list-pending")).toBeNull();
    act(() =>
      useSessions.setState({
        views: {
          [session.id]: {
            connected: true,
            revision: 0,
            snapshot: {
              sessionId: session.id,
              streamId: "stream",
              workspaceId: "project",
              operation: "idle",
              tools: {},
              model: { id: "test", name: "Test", provider: "test" },
              state: {
                messages: [],
                isRunning: false,
                outcome: "success",
                hasPendingSave: false,
                listenerErrors: [],
                pendingUserInputs: [],
              },
            },
          },
        },
      }),
    );
    expect(ui.queryByText("Needs input")).toBeNull();
    act(() => useSessions.setState({ views: {} }));
    expect(ui.getByText("Needs input")).toBeTruthy();
    ui.rerender(
      <QueryClientProvider client={client}>
        <ul>
          <SessionItem
            session={{ ...session, isWaitingForUserInput: false, isWaitingForApproval: true }}
          />
        </ul>
      </QueryClientProvider>,
    );
    expect(ui.queryByText("Needs input")).toBeNull();
    expect(ui.getByRole("img", { name: "Waiting for approval" })).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
