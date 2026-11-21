import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test } from "vitest";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { useSessions } from "../state/session-store";
import { useUnreadSessions } from "./useUnreadSessions";

test("unread aggregates all accessible lists and follows live state and cache refreshes", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const state = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const session = (id: string, workspaceId: string | null): SessionSummary => ({
    id,
    workspaceId,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 2,
    userMessageCount: 1,
    unread: false,
  });
  const chats = Array.from({ length: 8 }, (_, i) => session("chat-" + i, "project"));
  client.setQueryData(
    ["projects"],
    [
      { id: "project", name: "Project", cwd: "." },
      { id: "hidden", name: "Unavailable", cwd: ".", accessible: false },
    ],
  );
  client.setQueryData(["sessions", "project"], chats);
  client.setQueryData(["sessions", "hidden"], [{ ...session("hidden", "hidden"), unread: true }]);
  client.setQueryData(
    ["sessions", null],
    [
      session("global", null),
      { ...session("foreign", "other"), unread: true },
      { ...session("archived", null), unread: true, archived: true },
      { ...session("empty", null), unread: true, userMessageCount: 0 },
    ],
  );
  try {
    useSessions.setState({ views: {} });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders++;
        return useUnreadSessions();
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current).toBe(false));
    await act(async () => {
      client.setQueryData(
        ["sessions", "project"],
        chats.map((chat, i) => ({ ...chat, unread: i === 7 })),
      );
    });
    await waitFor(() => expect(result.current).toBe(true));
    act(() => {
      useSessions.setState({
        views: {
          "chat-7": { connected: true, snapshot: { state: { unread: false } } as SessionSnapshot },
        },
      });
    });
    await waitFor(() => expect(result.current).toBe(false));
    const settledRenders = renders;
    act(() => {
      useSessions.setState({
        views: {
          "chat-7": {
            connected: true,
            snapshot: {
              state: { unread: false, draft: { content: "Streaming update" } },
            } as unknown as SessionSnapshot,
          },
        },
      });
    });
    expect(renders).toBe(settledRenders);
    act(() => useSessions.setState({ views: {} }));
    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => {
      client.setQueryData(["sessions", "project"], chats);
      client.setQueryData(["sessions", null], [{ ...session("global", null), unread: true }]);
    });
    await waitFor(() => expect(result.current).toBe(true));
    await act(async () => client.setQueryData(["sessions", null], [session("global", null)]));
    await waitFor(() => expect(result.current).toBe(false));
  } finally {
    cleanup();
    client.clear();
    useSessions.setState(state, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
