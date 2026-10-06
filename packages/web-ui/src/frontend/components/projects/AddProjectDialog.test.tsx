import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { AddProjectDialog } from "./AddProjectDialog";

const previous = {
  window: globalThis.window,
  document: globalThis.document,
  fetch: globalThis.fetch,
};
const language = i18n.language;
let window: Window;
let client: QueryClient;
let testing: typeof import("@testing-library/react/pure");

beforeEach(async () => {
  window = new Window();
  Object.assign(globalThis, { window, document: window.document });
  testing = await import("@testing-library/react/pure");
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["projects"], []);
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  await testing.act(async () => {
    testing.cleanup();
    client.clear();
    await i18n.changeLanguage(language);
  });
  Object.assign(globalThis, previous);
  await window.happyDOM.close();
});

const showDialog = () => {
  const onAdded = vi.fn();
  const onClose = vi.fn();
  const ui = testing.render(
    <QueryClientProvider client={client}>
      <AddProjectDialog onAdded={onAdded} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { ...ui, onAdded, onClose };
};

test.each(["", "   ", "  Custom project  "])(
  "create uses an optional trimmed name and a removable folder: %j",
  async (name) => {
    const writes: unknown[] = [];
    const project = {
      id: "p",
      cwd: "/example/source-folder",
      name: name.trim() || "source-folder",
    };
    globalThis.fetch = vi.fn(async (url, init) => {
      if (String(url).endsWith("/pick")) return Response.json({ path: project.cwd + "/" });
      if (init?.method === "POST") {
        writes.push(JSON.parse(String(init.body)));
        return Response.json(project);
      }
      return Response.json([]);
    }) as typeof fetch;
    const ui = showDialog();
    const input = ui.getByRole("textbox", { name: "Project name" });
    expect(document.activeElement).toBe(input);
    expect(ui.getByRole("dialog", { name: "Create project" })).toBeTruthy();
    expect(ui.queryByText("Browse folders")).toBeNull();
    expect(ui.getByRole("button", { name: "Create project" }).hasAttribute("disabled")).toBe(true);
    await testing.act(async () => {
      testing.fireEvent.change(input, { target: { value: name } });
      testing.fireEvent.click(ui.getByRole("button", { name: "Add" }));
    });
    await testing.waitFor(() => expect(ui.getByText("source-folder")).toBeTruthy());
    expect(ui.getByText("This computer")).toBeTruthy();
    expect(writes).toEqual([]);
    await testing.act(async () =>
      testing.fireEvent.click(ui.getByRole("button", { name: "Remove folder source-folder" })),
    );
    expect(ui.queryByText("source-folder")).toBeNull();
    expect((input as HTMLInputElement).value).toBe(name);
    expect(ui.getByRole("button", { name: "Create project" }).hasAttribute("disabled")).toBe(true);
    await testing.act(async () => testing.fireEvent.click(ui.getByRole("button", { name: "Add" })));
    await testing.waitFor(() => expect(ui.getByText("source-folder")).toBeTruthy());
    await testing.act(async () =>
      testing.fireEvent.click(ui.getByRole("button", { name: "Create project" })),
    );
    await testing.waitFor(() => expect(ui.onAdded).toHaveBeenCalledWith(project));
    expect(ui.onClose).toHaveBeenCalledOnce();
    expect(writes).toEqual([
      { path: project.cwd + "/", ...(name.trim() ? { name: name.trim() } : {}) },
    ]);
  },
);

test("cancelled and failed selection retain the dialog and allow another Add", async () => {
  let attempts = 0;
  globalThis.fetch = vi.fn(async () => {
    attempts++;
    if (attempts === 1) return Response.json({ path: null });
    if (attempts === 2) return Response.json({ code: "native_unavailable" }, { status: 409 });
    return Response.json({ path: "/example/folder" });
  }) as typeof fetch;
  const ui = showDialog();
  await testing.act(async () => testing.fireEvent.click(ui.getByRole("button", { name: "Add" })));
  await testing.waitFor(() =>
    expect(ui.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(false),
  );
  expect(ui.queryByRole("alert")).toBeNull();
  expect(ui.onAdded).not.toHaveBeenCalled();
  await testing.act(async () => testing.fireEvent.click(ui.getByRole("button", { name: "Add" })));
  await testing.waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
  expect(ui.queryByText("Browse folders")).toBeNull();
  await testing.act(async () => testing.fireEvent.click(ui.getByRole("button", { name: "Add" })));
  await testing.waitFor(() => expect(ui.getByText("folder")).toBeTruthy());
  expect(ui.queryByRole("alert")).toBeNull();
  expect(attempts).toBe(3);
});

test("failed creation preserves inputs for retry and pending creation blocks changes", async () => {
  let finish!: (response: Response) => void;
  let attempts = 0;
  globalThis.fetch = vi.fn(async (url, init) => {
    if (String(url).endsWith("/pick")) return Response.json({ path: "/example/folder" });
    if (init?.method === "POST") {
      attempts++;
      if (attempts === 1)
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      return Response.json({ id: "p", cwd: "/example/folder", name: "Custom" });
    }
    return Response.json([]);
  }) as typeof fetch;
  const ui = showDialog();
  const input = ui.getByRole("textbox", { name: "Project name" });
  await testing.act(async () => {
    testing.fireEvent.change(input, { target: { value: "Custom" } });
    testing.fireEvent.click(ui.getByRole("button", { name: "Add" }));
  });
  await testing.waitFor(() => expect(ui.getByText("folder")).toBeTruthy());
  await testing.act(async () =>
    testing.fireEvent.click(ui.getByRole("button", { name: "Create project" })),
  );
  await testing.waitFor(() => expect(input.hasAttribute("disabled")).toBe(true));
  for (const name of ["Close", "Cancel", "Remove folder folder", "Saving…"]) {
    expect(ui.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
  }
  await testing.act(async () => {
    finish(Response.json({ code: "directory_unreadable" }, { status: 400 }));
  });
  await testing.waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
  expect((input as HTMLInputElement).value).toBe("Custom");
  expect(ui.getByText("folder")).toBeTruthy();
  expect(ui.onClose).not.toHaveBeenCalled();
  await testing.act(async () =>
    testing.fireEvent.click(ui.getByRole("button", { name: "Create project" })),
  );
  await testing.waitFor(() => expect(ui.onAdded).toHaveBeenCalledOnce());
  expect(attempts).toBe(2);
});

test.each(["Cancel", "Close"])("%s closes without registering a project", async (button) => {
  globalThis.fetch = vi.fn() as typeof fetch;
  const ui = showDialog();
  await testing.act(async () => testing.fireEvent.click(ui.getByRole("button", { name: button })));
  expect(ui.onClose).toHaveBeenCalledOnce();
  expect(ui.onAdded).not.toHaveBeenCalled();
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
