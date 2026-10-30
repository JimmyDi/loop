import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import type { Project, SessionSummary } from "../../../shared/protocol";
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
  expect(html).toContain("New task");
  expect(html.indexOf("sidebar-new-task")).toBeLessThan(html.indexOf("sidebar-scroll"));
  expect(html.slice(html.indexOf("sidebar-scroll"))).not.toContain("sidebar-new-task");
  expect(html).toContain("Loop");
  expect(html).toContain("More");
  expect(html).toContain('aria-haspopup="menu"');
  expect(html).not.toContain("Sign in");
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
      const group = ui.getByRole("button", { name: "Expand or collapse projects" });
      fireEvent.click(group);
      fireEvent.click(ui.getByRole("button", { name: "Add project" }));
      const dialog = within(ui.getByRole("dialog", { name: "Create project" }));
      await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Add" })));
      const input = dialog.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("");
      expect(dialog.getByText("example")).toBeTruthy();
      fireEvent.click(dialog.getByRole("button", { name: "Create project" }));
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
        expect(input.value).toBe("");
        expect(dialog.getByText("example")).toBeTruthy();
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
        expect(
          within(folder.closest(".project-item") as HTMLElement).getByText("No chats"),
        ).toBeTruthy();
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

test("pin actions move sessions above Projects without selecting them and work while Projects is collapsed", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, waitFor, cleanup, within } = await import(
    "@testing-library/react/pure"
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const project: Project = { id: "p", name: "Example project", cwd: "/example" };
  let sessions: SessionSummary[] = Array.from({ length: 7 }, (_, index) => ({
    id: "s" + index,
    workspaceId: "p",
    title: "Chat " + index,
    messageCount: 2,
    userMessageCount: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }));
  client.setQueryData(["projects"], [project]);
  client.setQueryData(["sessions", "p"], sessions);
  let requests = 0;
  globalThis.fetch = (async (url, init) => {
    if (init?.method === "PUT") {
      requests++;
      const body = JSON.parse(String(init.body));
      const session = sessions.find(
        (session) => String(url) === "/api/sessions/" + session.id + "/pin",
      )!;
      const pinnedAt = body.pinned ? new Date(1000 + requests).toISOString() : undefined;
      sessions = sessions.map((item) => (item.id === session.id ? { ...item, pinnedAt } : item));
      return Response.json({ pinnedAt: pinnedAt ?? null });
    }
    return Response.json(sessions);
  }) as typeof fetch;
  try {
    useWorkspace.setState({ expanded: {}, active: { id: "other", workspaceId: "p" } });
    const ui = render(
      <QueryClientProvider client={client}>
        <Sidebar />
      </QueryClientProvider>,
    );
    expect(ui.queryByRole("heading", { name: "Pinned" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Pin Chat 0" }));
    await waitFor(() => expect(ui.getByRole("region", { name: "Pinned" })).toBeTruthy());
    const pinned = within(ui.getByRole("region", { name: "Pinned" }));
    expect(pinned.getByRole("button", { name: "Chat 0" })).toBeTruthy();
    expect(ui.getAllByRole("button", { name: "Chat 0" })).toHaveLength(1);
    // Moving an item out of a project reveals the next item within its five-row limit.
    expect(ui.getByRole("button", { name: "Chat 5" })).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Chat 6" })).toBeNull();
    fireEvent.contextMenu(ui.getByRole("button", { name: "Chat 1" }));
    fireEvent.click(ui.getByRole("menuitem", { name: "Pin" }));
    await waitFor(() =>
      expect(
        Array.from(
          ui.container.querySelectorAll(".pinned-sessions .session-list-title"),
          (item) => item.textContent,
        ),
      ).toEqual(["Chat 1", "Chat 0"]),
    );
    expect(useWorkspace.getState().active?.id).toBe("other");
    fireEvent.click(ui.getByRole("button", { name: "Expand or collapse projects" }));
    expect(ui.queryByRole("button", { name: project.name })).toBeNull();
    expect(pinned.getByRole("button", { name: "Chat 0" })).toBeTruthy();
    // Shared project queries supply live titles while the Projects section is collapsed.
    await act(async () => {
      client.setQueryData(
        ["sessions", "p"],
        sessions.map((session) =>
          session.id === "s0"
            ? { ...session, title: "Updated title", isGenerating: true }
            : session,
        ),
      );
    });
    await waitFor(() => expect(pinned.getByTitle("Updated title")).toBeTruthy());
    expect(pinned.getByRole("img", { name: "Looping..." })).toBeTruthy();
    fireEvent.click(pinned.getByRole("button", { name: "Unpin Updated title" }));
    await act(async () => {
      await sleep(30);
    });
    expect(useWorkspace.getState().active?.id).toBe("other");
    fireEvent.contextMenu(pinned.getByRole("button", { name: "Chat 1" }));
    fireEvent.click(ui.getByRole("menuitem", { name: "Unpin" }));
    await act(async () => {
      await sleep(30);
    });
    expect(ui.queryByRole("region", { name: "Pinned" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Expand or collapse projects" }));
    expect(ui.getByTitle("Chat 0")).toBeTruthy();
    expect(requests).toBe(4);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("chat and project pagination remain distinct and reveal only their own items", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, staleTime: Infinity } },
  });
  const projects: Project[] = Array.from({ length: 6 }, (_, index) => ({
    id: "project-" + index,
    name: "Project " + index,
    cwd: "/example",
  }));
  client.setQueryData(["projects"], projects);
  client.setQueryData(["sessions", null], []);
  for (const [index, project] of projects.entries()) {
    const sessions: SessionSummary[] = Array.from({ length: index === 4 ? 16 : 0 }, (_, i) => ({
      id: "chat-" + i,
      workspaceId: project.id,
      title: "Chat " + i,
      messageCount: 2,
      userMessageCount: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }));
    client.setQueryData(["sessions", project.id], sessions);
  }
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <Sidebar />
      </QueryClientProvider>,
    );
    expect(ui.container.querySelectorAll(".project-item")).toHaveLength(5);
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(5);
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(15);
    expect(ui.container.querySelectorAll(".project-item")).toHaveLength(5);
    expect(ui.getByRole("button", { name: "Show more" })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Show more projects" }));
    expect(ui.container.querySelectorAll(".project-item")).toHaveLength(6);
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(15);
    expect(ui.queryByRole("button", { name: "Show more projects" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(16);
    expect(ui.queryByRole("button", { name: "Show more" })).toBeNull();
    const child = ui.getByRole("button", { name: "Project 0" });
    fireEvent.click(child);
    const childStates = { ...useWorkspace.getState().expanded };
    const parent = ui.getByRole("button", { name: "Expand or collapse projects" });
    fireEvent.click(parent);
    expect(ui.queryByRole("button", { name: "Project 0" })).toBeNull();
    expect(useWorkspace.getState().expanded).toEqual(childStates);
    const scroll = ui.container.querySelector<HTMLElement>(".sidebar-scroll")!;
    let scrollEvents = 0;
    scroll.addEventListener("scroll", () => scrollEvents++);
    const position = scroll.scrollTop;
    fireEvent.click(parent);
    expect(scroll.scrollTop).toBe(position);
    expect(scrollEvents).toBe(0);
    expect(ui.getByRole("button", { name: "Project 0" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(ui.getByRole("button", { name: "Project 4" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(16);
    const parentLabel = ui.getByRole("button", { name: "Projects" });
    fireEvent.click(parentLabel);
    expect(ui.queryByRole("button", { name: "Project 0" })).toBeNull();
    expect(useWorkspace.getState().expanded).toEqual(childStates);
    fireEvent.click(parentLabel);
    expect(scroll.scrollTop).toBe(position);
    expect(scrollEvents).toBe(0);
    expect(ui.getByRole("button", { name: "Project 0" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(ui.getByRole("button", { name: "Project 4" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(useWorkspace.getState().expanded).toEqual(childStates);
    const expandedChild = ui.getByRole("button", { name: "Project 4" });
    fireEvent.click(expandedChild);
    fireEvent.click(expandedChild);
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(16);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
