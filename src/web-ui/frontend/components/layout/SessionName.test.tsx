import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../../shared/protocol";
import "../../i18n/setup";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import { SessionHeader } from "./SessionHeader";
import { SessionTabs } from "./SessionTabs";
import { SessionList } from "../projects/SessionList";

test("inline name selects text, confirms once, synchronizes all names and preserves failed edits", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  const { render, fireEvent, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const original: SessionSnapshot = {
    sessionId: "rename-test",
    workspaceId: "project",
    streamId: "stream",
    operation: "idle",
    tools: {},
    model: { provider: "example", id: "example", name: "Example" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      title: { text: "Original name", source: "fallback", messageIndices: [0] },
    },
  };
  const summaries: SessionSummary[] = [
    {
      id: original.sessionId,
      workspaceId: "project",
      title: "Original name",
      messageCount: 0,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];
  let finish!: (response: Response) => void;
  const requests: { method?: string; title: string }[] = [];
  globalThis.fetch = (async (_url, init) => {
    requests.push({ method: init?.method, title: JSON.parse(String(init?.body)).title });
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  useSessions.setState({
    views: { [original.sessionId]: { snapshot: original, connected: true } },
  });
  useWorkspace.setState({
    tabs: [{ id: original.sessionId, workspaceId: "project", title: "Original name" }],
  });
  const view = (snapshot = original) => (
    <QueryClientProvider client={client}>
      <SessionHeader snapshot={snapshot} />
      <SessionTabs />
      <SessionList sessions={summaries} />
    </QueryClientProvider>
  );
  try {
    const ui = render(view());
    const name = () => ui.container.querySelector<HTMLButtonElement>(".session-name-button")!;
    const edit = () => ui.getByRole("textbox", { name: "Conversation title" }) as HTMLInputElement;
    fireEvent.click(name());
    expect(document.activeElement).toBe(edit());
    expect(edit().selectionStart).toBe(0);
    expect(edit().selectionEnd).toBe("Original name".length);
    fireEvent.change(edit(), { target: { value: "New name" } });
    fireEvent.keyDown(edit(), { key: "Enter", isComposing: true });
    expect(requests).toHaveLength(0);
    fireEvent.keyDown(edit(), { key: "Enter" });
    fireEvent.keyDown(edit(), { key: "Enter" });
    expect(requests).toEqual([{ method: "PUT", title: "New name" }]);
    expect(edit().readOnly).toBe(true);
    await act(async () =>
      finish(
        Response.json({
          ...original,
          state: {
            ...original.state,
            title: { text: "New name", source: "user", messageIndices: [] },
          },
        }),
      ),
    );
    await waitFor(() => expect(name().textContent).toBe("New name"));
    expect(ui.getAllByRole("button", { name: "New name" })).toHaveLength(3);
    expect(document.activeElement).toBe(name());

    fireEvent.click(name());
    fireEvent.change(edit(), { target: { value: "Unsaved name" } });
    fireEvent.keyDown(edit(), { key: "Escape" });
    expect(name().textContent).toBe("New name");
    expect(requests).toHaveLength(1);
    fireEvent.click(name());
    fireEvent.change(edit(), { target: { value: " " } });
    fireEvent.keyDown(edit(), { key: "Enter" });
    expect(edit().getAttribute("aria-invalid")).toBe("true");
    expect(requests).toHaveLength(1);
    fireEvent.blur(edit());
    expect(name().textContent).toBe("New name");

    fireEvent.click(name());
    fireEvent.change(edit(), { target: { value: "Retry name" } });
    fireEvent.keyDown(edit(), { key: "Enter" });
    await act(async () => finish(Response.json({ code: "operation_failed" }, { status: 500 })));
    await waitFor(() => expect(ui.getByRole("alert").textContent).toContain("Operation failed"));
    expect(edit().value).toBe("Retry name");
    expect(useWorkspace.getState().tabs[0]?.title).toBe("New name");
    fireEvent.keyDown(edit(), { key: "Escape" });
    ui.rerender(view({ ...original, operation: "prompt" }));
    expect(name().disabled).toBe(true);
  } finally {
    cleanup();
    client.clear();
    useSessions.setState({ views: {} });
    useWorkspace.setState({ tabs: [] });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
