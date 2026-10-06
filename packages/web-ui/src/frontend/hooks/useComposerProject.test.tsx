import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { useWorkspace } from "../state/workspace-store";

test.each([false, true])(
  "switching draft project preserves input and configuration; failure=%s",
  async (failure) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const state = useWorkspace.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useComposerProject } = await import("./useComposerProject");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const a = { id: "a", name: "First", cwd: "/first" };
    const b = { id: "b", name: "Second", cwd: "/second" };
    client.setQueryData(["projects"], [a, b]);
    const snapshot: SessionSnapshot = {
      sessionId: "old",
      workspaceId: "a",
      streamId: "stream",
      operation: "idle",
      tools: {},
      model: { provider: "example", id: "selected", name: "Selected" },
      effort: "high",
      state: {
        messages: [],
        isRunning: false,
        hasPendingSave: false,
        outcome: "idle",
        listenerErrors: [],
        permissionPreset: "workspace-write",
      },
    };
    let next: SessionSnapshot = {
      ...snapshot,
      sessionId: "new",
      workspaceId: "b",
      model: { provider: "example", id: "default", name: "Default" },
      effort: "low",
      state: { ...snapshot.state, permissionPreset: "read-only" },
    };
    const writes: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      writes.push({ url: String(url), body });
      if (failure) return Response.json({ code: "project_busy" }, { status: 409 });
      if (String(url).endsWith("/model"))
        next = { ...next, model: snapshot.model, effort: snapshot.effort };
      if (String(url).endsWith("/permission"))
        next = {
          ...next,
          state: { ...next.state, permissionPreset: snapshot.state.permissionPreset },
        };
      return Response.json(next);
    }) as typeof fetch;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    try {
      useWorkspace.setState({
        active: { id: "old", workspaceId: "a" },
        drafts: { old: "Keep text" },
        images: { old: [{ type: "image", data: "aA==", mimeType: "image/png" }] },
        files: { old: [{ name: "example.txt", text: "Keep file" }] },
        unselectedProjects: {},
      });
      const { result } = renderHook(() => useComposerProject(snapshot, true), { wrapper });
      act(() => result.current.clear());
      expect(result.current.hasProject).toBe(false);
      expect(useWorkspace.getState().drafts.old).toBe("Keep text");
      let selected = false;
      await act(async () => {
        selected = await result.current.select(b);
      });
      expect(selected).toBe(!failure);
      if (failure) {
        expect(result.current.error).toBeTruthy();
        expect(result.current.hasProject).toBe(false);
        expect(useWorkspace.getState().active?.id).toBe("old");
        expect(useWorkspace.getState().drafts.old).toBe("Keep text");
      } else {
        expect(writes.map((item) => item.url)).toEqual([
          "/api/sessions",
          "/api/sessions/new/model",
          "/api/sessions/new/permission",
        ]);
        expect(writes[0]?.body).toEqual({ workspaceId: "b" });
        expect(useWorkspace.getState().active).toEqual({ id: "new", workspaceId: "b" });
        expect(useWorkspace.getState().drafts.new).toBe("Keep text");
        expect(useWorkspace.getState().files.new?.[0]?.text).toBe("Keep file");
        expect(useWorkspace.getState().images.new).toHaveLength(1);
        expect(client.getQueryData(["session", "new"])).toEqual(next);
        expect(next.state.permissionPreset).toBe("workspace-write");
        expect(next.effort).toBe("high");
      }
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(state, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
