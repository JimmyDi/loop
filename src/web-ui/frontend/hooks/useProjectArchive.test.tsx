import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import type { ReactNode } from "react";

import { useProjectArchive } from "./useProjectArchive";
import { useWorkspace } from "../state/workspace-store";

test.each([true, false])(
  "archive mutation preserves drafts and unrelated active chats, success: %s",
  async (success) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const state = useWorkspace.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { renderHook, act, waitFor, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient();
    let complete!: () => void;
    globalThis.fetch = (async () => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      return success
        ? new Response(null, { status: 204 })
        : Response.json({ code: "project_busy" }, { status: 409 });
    }) as unknown as typeof fetch;
    try {
      useWorkspace.setState({
        active: { id: "selected", workspaceId: "p" },
        drafts: { selected: "Draft" },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useProjectArchive("p"), { wrapper });
      const request = result.current
        .mutateAsync({ ids: ["selected"], archived: true })
        .catch(() => {});
      await act(async () => {
        await Promise.resolve();
      });
      expect(useWorkspace.getState().active?.id).toBe("selected");
      useWorkspace.getState().open({ id: "other", workspaceId: "q" });
      await act(async () => {
        complete();
        await request;
      });
      expect(useWorkspace.getState().active).toEqual({ id: "other", workspaceId: "q" });
      expect(useWorkspace.getState().drafts.selected).toBe("Draft");
      await waitFor(() => expect(result.current.isError).toBe(!success));
      await waitFor(() => expect(result.current.isPending).toBe(false));
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(state, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
