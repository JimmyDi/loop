import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ArchivedChats } from "./ArchivedChats";
import { useWorkspace } from "../../state/workspace-store";

test("archived chats can be opened and restored without deleting history", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let archived = true;
  let body: unknown;
  let opened = 0;
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "POST") {
      body = JSON.parse(String(init.body));
      archived = false;
      return new Response(null, { status: 204 });
    }
    if (String(url).endsWith("/workspaces"))
      return Response.json([{ id: "p", name: "Example", cwd: "/example" }]);
    return Response.json(
      archived
        ? [
            {
              id: "s",
              workspaceId: "p",
              title: "Saved chat",
              updatedAt: "2026-09-01T08:30:00Z",
              messageCount: 1,
            },
          ]
        : [],
    );
  }) as typeof fetch;
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <ArchivedChats onOpen={() => opened++} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ui.getByRole("button", { name: /^Saved chat/ })).toBeTruthy());
    expect(ui.getByRole("region", { name: "Example" })).toBeTruthy();
    expect(ui.getByText("1 chat")).toBeTruthy();
    expect(ui.queryByRole("searchbox")).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: /^Saved chat/ }));
    expect(useWorkspace.getState().active).toEqual({ id: "s", workspaceId: "p" });
    expect(opened).toBe(1);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Restore Saved chat" })));
    await waitFor(() => expect(ui.getByText("No archived chats")).toBeTruthy());
    expect(body).toEqual({ ids: ["s"], archived: false });
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("archive page groups and filters chats and confirms selected deletion", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let records = [
    { id: "a", workspaceId: "p", title: "First", messageCount: 2 },
    { id: "b", workspaceId: "q", title: "Second", messageCount: 0 },
  ];
  const writes: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "DELETE") {
      const body = JSON.parse(String(init.body));
      writes.push(body);
      records = records.filter((session) => !body.ids.includes(session.id));
      return new Response(null, { status: 204 });
    }
    if (String(url).endsWith("/workspaces"))
      return Response.json([
        { id: "p", name: "Alpha" },
        { id: "q", name: "Beta" },
      ]);
    const project = new URL(String(url), "http://localhost").searchParams.get("workspaceId");
    return Response.json(
      records
        .filter((session) => session.workspaceId === project)
        .map((session) => ({ ...session, updatedAt: "2026-09-01T08:30:00Z" })),
    );
  }) as typeof fetch;
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <ArchivedChats />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ui.getByRole("region", { name: "Beta" })).toBeTruthy());
    fireEvent.change(ui.getByRole("combobox", { name: "Filter projects" }), {
      target: { value: "p" },
    });
    expect(ui.queryByRole("region", { name: "Beta" })).toBeNull();
    fireEvent.change(ui.getByRole("combobox", { name: "Filter projects" }), {
      target: { value: "" },
    });
    fireEvent.change(ui.getByRole("combobox", { name: "Filter chats" }), {
      target: { value: "empty" },
    });
    expect(ui.queryByRole("region", { name: "Alpha" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Delete Second" }));
    expect(ui.getByRole("dialog", { name: "Delete 1 archived chat?" })).toBeTruthy();
    expect(writes).toEqual([]);
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(writes).toEqual([]);
    fireEvent.click(ui.getByRole("button", { name: "Delete all" }));
    expect(ui.getByRole("dialog", { name: "Delete 2 archived chats?" })).toBeTruthy();
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Delete permanently" })));
    await waitFor(() => expect(ui.queryByRole("dialog")).toBeNull());
    expect(writes).toEqual([{ ids: ["a"] }, { ids: ["b"] }]);
    expect(ui.getByText("No archived chats")).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
