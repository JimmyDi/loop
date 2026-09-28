import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { SessionRenameInput } from "./SessionRenameInput";
import { useSessions } from "../../state/session-store";

test("inline rename saves on Enter without opening a session and Escape cancels", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  client.setQueryData(["sessions", "p"], [{ id: "s", title: "Before" }]);
  const calls: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push([url, init?.method, JSON.parse(String(init?.body))]);
    return Response.json({
      sessionId: "s",
      workspaceId: "p",
      streamId: "stream",
      state: { title: { text: "After", source: "user" } },
    });
  }) as typeof fetch;
  let closed = 0;
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <SessionRenameInput id="s" title="Before" onClose={() => closed++} />
      </QueryClientProvider>,
    );
    const input = ui.getByRole("textbox");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "  After  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(closed).toBe(1));
    expect(calls).toEqual([["/api/sessions/s/title", "PUT", { title: "After" }]]);
    expect(client.getQueryData<{ id: string; title: string }[]>(["sessions", "p"])).toEqual([
      { id: "s", title: "After" },
    ]);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(closed).toBe(2);
    expect(calls.length).toBe(1);
  } finally {
    cleanup();
    client.clear();
    useSessions.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
