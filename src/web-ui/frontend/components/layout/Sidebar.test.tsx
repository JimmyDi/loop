import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { Project } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { Sidebar } from "./Sidebar";

test("Sidebar exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Sidebar />
    </QueryClientProvider>,
  );

  expect(html).toContain("Projects");
  expect(html).toContain("Loop");
  expect(html).toContain("Settings");
  expect(html).not.toContain("Model settings");
  expect(html).not.toContain("Language");
  client.clear();
});

test.each(["new", "existing", "failure"])(
  "adding a folder reveals its expanded node without creating a chat: %s",
  async (scenario) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const state = useWorkspace.getState();
    const language = i18n.language;
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, act, waitFor, cleanup, within } = await import(
      "@testing-library/react/pure"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const project: Project = { id: "added", name: "Example", cwd: "/example" };
    const projects: Project[] = [{ id: "other", name: "Other", cwd: "/other" }];
    if (scenario === "existing") projects.push(project);
    client.setQueryData(["projects"], projects);
    client.setQueryData(["sessions", project.id], []);
    client.setQueryData(["directory-capabilities"], { native: true, preferred: "native" });
    const writes: { url: string; body: unknown }[] = [];
    const scrolled: string[] = [];
    window.HTMLElement.prototype.scrollIntoView = function () {
      scrolled.push(this.getAttribute("data-project-id") ?? "");
    };
    let finishSave!: (response: Response) => void;
    let finishRefresh!: (response: Response) => void;
    const saving = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    const refreshing = new Promise<Response>((resolve) => {
      finishRefresh = resolve;
    });
    globalThis.fetch = (async (url, init) => {
      if (String(url) === "/api/directories/pick") return Response.json({ path: project.cwd });
      if (init?.method === "POST") {
        writes.push({ url: String(url), body: JSON.parse(String(init.body)) });
        return saving;
      }
      if (String(url) === "/api/workspaces") return refreshing;
      return Response.json([]);
    }) as typeof fetch;
    try {
      await i18n.changeLanguage("en");
      useWorkspace.setState({
        active: { id: "selected", workspaceId: "other" },
        expanded: { other: false, added: false },
      });
      const ui = render(
        <QueryClientProvider client={client}>
          <Sidebar />
        </QueryClientProvider>,
      );
      const group = ui.getByRole("button", { name: "Projects" });
      fireEvent.click(group);
      fireEvent.click(ui.getByRole("button", { name: "Add project" }));
      const dialog = within(ui.getByRole("dialog", { name: "Add project" }));
      await act(async () =>
        fireEvent.click(dialog.getByRole("button", { name: "Choose folder…" })),
      );
      const input = dialog.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe(project.cwd);
      fireEvent.click(dialog.getByRole("button", { name: "Add project" }));
      await waitFor(() => expect(writes).toHaveLength(1));
      await waitFor(() =>
        expect(dialog.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true),
      );
      await act(async () => {
        finishSave(
          scenario === "failure"
            ? Response.json({ code: "directory_unreadable" }, { status: 400 })
            : Response.json(project),
        );
      });
      if (scenario === "failure") {
        await waitFor(() => expect(dialog.getByRole("alert")).toBeTruthy());
        expect(input.value).toBe(project.cwd);
        expect(group.getAttribute("aria-expanded")).toBe("false");
        expect(scrolled).toEqual([]);
        expect(client.getQueryData<Project[]>(["projects"])).toEqual(projects);
      } else {
        // A slow list refresh must not delay revealing the confirmed project.
        await waitFor(() => expect(ui.queryByRole("dialog")).toBeNull());
        const folder = ui.getByRole("button", { name: project.name });
        expect(group.getAttribute("aria-expanded")).toBe("true");
        expect(folder.getAttribute("aria-expanded")).toBe("true");
        expect(document.activeElement).toBe(folder);
        expect(scrolled).toEqual([project.id]);
        expect(ui.getByText("No chats")).toBeTruthy();
        expect(ui.getAllByRole("button", { name: project.name })).toHaveLength(1);
        expect(ui.getByRole("button", { name: "Other" }).getAttribute("aria-expanded")).toBe(
          "false",
        );
      }
      expect(writes).toEqual([{ url: "/api/workspaces", body: { path: project.cwd } }]);
      expect(useWorkspace.getState().active).toEqual({ id: "selected", workspaceId: "other" });
    } finally {
      finishSave(Response.json(project));
      finishRefresh(Response.json([...projects.filter((item) => item.id !== project.id), project]));
      cleanup();
      client.clear();
      useWorkspace.setState(state, true);
      await i18n.changeLanguage(language);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
