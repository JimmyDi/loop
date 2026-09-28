import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ProjectItem } from "./ProjectItem";

test("ProjectItem exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ProjectItem project={{ id: "p", name: "Example", cwd: "/example", accessible: false }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Example");
  expect(html).toContain("Directory unavailable");
  expect(html).toContain("disabled");
  client.clear();
});

test("folder toggles independently and compose creates a session from a collapsed project", async () => {
  const { Window } = await import("happy-dom");
  const { useWorkspace } = await import("../../state/workspace-store");
  const window = new Window();
  const state = useWorkspace.getState();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["projects"], []);
  client.setQueryData(["sessions", "p"], []);
  let creates = 0;
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "POST") {
      creates++;
      return Response.json({ sessionId: "new" });
    }
    return Response.json([]);
  }) as typeof fetch;
  try {
    useWorkspace.setState({ active: undefined, expanded: { p: true } });
    const ui = render(
      <QueryClientProvider client={client}>
        <ProjectItem project={{ id: "p", name: "Example", cwd: "/example" }} />
      </QueryClientProvider>,
    );
    const folder = ui.getByRole("button", { name: "Example" });
    const opened = folder.querySelector("path")?.getAttribute("d");
    fireEvent.click(folder);
    expect(folder.getAttribute("aria-expanded")).toBe("false");
    expect(folder.querySelector("path")?.getAttribute("d")).not.toBe(opened);
    fireEvent.click(ui.getByRole("button", { name: "Options for Example" }));
    expect(folder.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(ui.getByRole("menu"), { key: "Escape" });
    fireEvent.contextMenu(folder, { clientX: 180, clientY: 120 });
    expect(ui.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Archive chats",
      "Remove project",
    ]);
    expect(folder.getAttribute("aria-expanded")).toBe("false");
    expect(useWorkspace.getState().active).toBeUndefined();
    expect(creates).toBe(0);
    fireEvent.keyDown(ui.getByRole("menu"), { key: "Escape" });
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "New session" })));
    await waitFor(() => expect(useWorkspace.getState().active?.id).toBe("new"));
    expect(creates).toBe(1);
    expect(folder.getAttribute("aria-expanded")).toBe("true");
    expect(ui.queryByRole("button", { name: "Rename" })).toBeNull();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
