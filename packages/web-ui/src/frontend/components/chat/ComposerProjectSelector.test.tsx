import { expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import type { useComposerProject } from "../../hooks/useComposerProject";
import { ComposerProjectSelector } from "./ComposerProjectSelector";

test("capsule removal, keyboard project selection and Add folder reuse the creation dialog", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const project = { id: "p", name: "Example", cwd: "/example" };
  client.setQueryData(["projects"], [project]);
  const select = vi.fn(async () => true);
  const clear = vi.fn();
  const selection = {
    project,
    projects: { data: [project] } as ReturnType<typeof useComposerProject>["projects"],
    hasProject: true,
    select,
    clear,
    pending: false,
    error: undefined,
  };
  const view = (selected = true) => (
    <QueryClientProvider client={client}>
      <ComposerProjectSelector
        selection={{ ...selection, project: selected ? project : undefined }}
        disabled={false}
      />
    </QueryClientProvider>
  );
  try {
    const ui = render(view());
    fireEvent.click(ui.getByRole("button", { name: "Remove project Example" }));
    expect(clear).toHaveBeenCalledOnce();
    ui.rerender(view(false));
    fireEvent.click(ui.getByRole("button", { name: "Choose project" }));
    await waitFor(() =>
      expect(ui.getByRole("searchbox", { name: "Search projects" })).toBe(document.activeElement),
    );
    fireEvent.change(ui.getByRole("searchbox"), { target: { value: "Example" } });
    fireEvent.keyDown(ui.getByRole("searchbox"), { key: "Home" });
    expect(ui.getByRole("searchbox")).toBe(document.activeElement);
    fireEvent.keyDown(ui.getByRole("searchbox"), { key: "ArrowDown" });
    await waitFor(() =>
      expect(ui.getByRole("menuitemradio", { name: "Example" })).toBe(document.activeElement),
    );
    fireEvent.click(ui.getByRole("menuitemradio", { name: "Example" }));
    await waitFor(() => expect(select).toHaveBeenCalledWith(project));
    await waitFor(() => expect(ui.queryByRole("menu")).toBeNull());
    fireEvent.click(ui.getByRole("button", { name: "Choose project" }));
    expect((ui.getByRole("searchbox") as HTMLInputElement).value).toBe("");
    fireEvent.click(ui.getByRole("menuitem", { name: "Add folder…" }));
    expect(ui.getByRole("dialog", { name: "Create project" })).toBeTruthy();
    expect(ui.queryByRole("menu")).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(ui.queryByRole("dialog")).toBeNull();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
