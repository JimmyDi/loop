import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { useRequests } from "../../state/request-store";
import { ProjectActions } from "./ProjectActions";

test.each([true, false])(
  "removal requires a dialog and clears only this project's data after success: %s",
  async (success) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    const requests = useRequests.getState();
    const language = i18n.language;
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, act, waitFor, cleanup } = await import(
      "@testing-library/react/pure"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["projects"], []);
    let deletes = 0;
    globalThis.fetch = (async (_url, init) => {
      if (init?.method !== "DELETE") return Response.json([]);
      deletes++;
      return success
        ? new Response(null, { status: 204 })
        : Response.json({ code: "project_busy" }, { status: 409 });
    }) as typeof fetch;
    try {
      await i18n.changeLanguage("en");
      useWorkspace.setState({
        active: undefined,
        drafts: {},
        images: {},
        files: {},
        draftProjects: {},
      });
      useRequests.setState({ pending: {} });
      for (const session of [
        { id: "other", workspaceId: "q" },
        { id: "previous", workspaceId: "p" },
        { id: "selected", workspaceId: "p" },
      ]) {
        const state = useWorkspace.getState();
        state.open(session);
        state.draft(session.id, "Draft");
        state.attachFiles(session.id, [{ name: "example.txt", text: "Example" }]);
        useRequests
          .getState()
          .put(session.id, { requestId: session.id, streamId: "stream", text: "Draft" });
      }
      const ui = render(
        <QueryClientProvider client={client}>
          <ProjectActions project={{ id: "p", name: "Example", cwd: "/example" }} />
        </QueryClientProvider>,
      );
      const trigger = ui.getByRole("button", { name: "Options for Example" });
      fireEvent.click(trigger);
      expect(ui.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
        "Archive chats",
        "Remove project",
      ]);
      expect(ui.getByRole("separator")).toBeTruthy();
      fireEvent.keyDown(ui.getByRole("menu"), { key: "End" });
      expect(document.activeElement).toBe(ui.getByRole("menuitem", { name: "Remove project" }));
      fireEvent.keyDown(ui.getByRole("menu"), { key: "Escape" });
      expect(ui.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(trigger);
      fireEvent.click(trigger);
      fireEvent.click(ui.getByRole("menuitem", { name: "Remove project" }));
      expect(ui.getByRole("dialog", { name: "Remove Example?" }).parentElement).toBe(document.body);
      expect(ui.getByText(/unsent drafts/)).toBeTruthy();
      expect(deletes).toBe(0);
      fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
      expect(deletes).toBe(0);
      expect(document.activeElement).toBe(trigger);
      fireEvent.click(trigger);
      fireEvent.click(ui.getByRole("menuitem", { name: "Remove project" }));
      await act(async () => fireEvent.click(ui.getByRole("button", { name: "Remove project" })));
      await waitFor(() => expect(deletes).toBe(1));
      if (success) {
        await waitFor(() => expect(useWorkspace.getState().active).toBeUndefined());
        expect(Object.keys(useWorkspace.getState().drafts)).toEqual(["other"]);
        expect(Object.keys(useWorkspace.getState().files)).toEqual(["other"]);
        expect(Object.keys(useRequests.getState().pending)).toEqual(["other"]);
      } else {
        await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
        expect(useWorkspace.getState().active?.id).toBe("selected");
        expect(Object.keys(useWorkspace.getState().drafts)).toHaveLength(3);
        expect(Object.keys(useRequests.getState().pending)).toHaveLength(3);
        expect(ui.getByRole("dialog")).toBeTruthy();
      }
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      await i18n.changeLanguage(language);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("archive confirmation fetches collapsed history, requires consent and retains drafts", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["projects"], []);
  const writes: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "POST") {
      writes.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json(String(url).includes("/sessions?") ? [{ id: "a" }, { id: "b" }] : []);
  }) as typeof fetch;
  try {
    useWorkspace.setState({
      active: { id: "a", workspaceId: "p" },
      drafts: { a: "Unsent" },
      expanded: { p: false },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <ProjectActions project={{ id: "p", name: "Example", cwd: "/example" }} />
      </QueryClientProvider>,
    );
    fireEvent.click(ui.getByRole("button", { name: "Options for Example" }));
    fireEvent.click(ui.getByRole("menuitem", { name: "Archive chats" }));
    await waitFor(() => expect(ui.getByRole("dialog", { name: "Archive 2 chats?" })).toBeTruthy());
    expect(writes).toEqual([]);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Archive all" })));
    await waitFor(() => expect(ui.queryByRole("dialog")).toBeNull());
    expect(writes).toEqual([{ ids: ["a", "b"], archived: true }]);
    expect(useWorkspace.getState().active).toBeUndefined();
    expect(useWorkspace.getState().drafts.a).toBe("Unsent");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
