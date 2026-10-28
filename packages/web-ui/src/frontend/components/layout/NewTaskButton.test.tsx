import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test } from "vitest";

import type { Project } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { NewTaskButton } from "./NewTaskButton";

test.each(["selected", "switched", "fallback", "unavailable", "empty", "failure"])(
  "New task opens an empty draft using the current workspace: %s",
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
    const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient();
    const projects: Project[] = [
      { id: "first", name: "First", cwd: "/first" },
      { id: "selected", name: "Selected", cwd: "/selected" },
    ];
    if (scenario === "empty") projects.length = 0;
    if (scenario === "unavailable") projects[1].accessible = false;
    const writes: unknown[] = [];
    let finish!: (response: Response) => void;
    globalThis.fetch = (async (_url, init) => {
      writes.push(JSON.parse(String(init?.body)));
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    }) as typeof fetch;
    try {
      await i18n.changeLanguage("en");
      useWorkspace.setState({
        active: scenario === "fallback" ? undefined : { id: "old", workspaceId: "selected" },
        drafts: { old: "Keep draft" },
        sidebar: true,
      });
      const ui = render(
        <QueryClientProvider client={client}>
          <NewTaskButton projects={projects} />
        </QueryClientProvider>,
      );
      if (scenario === "switched") {
        act(() => useWorkspace.getState().open({ id: "other", workspaceId: "first" }));
      }
      const active = useWorkspace.getState().active;
      const button = ui.getByRole("button", { name: "New task" });
      fireEvent.click(button);
      fireEvent.click(button);
      if (scenario === "empty") {
        expect(button.hasAttribute("disabled")).toBe(true);
        expect(writes).toEqual([]);
        expect(useWorkspace.getState().active).toEqual(active);
        return;
      }
      expect(button.hasAttribute("disabled")).toBe(true);
      const workspaceId = ["fallback", "unavailable", "switched"].includes(scenario)
        ? "first"
        : "selected";
      expect(writes).toEqual([{ workspaceId }]);
      await act(async () => {
        finish(
          scenario === "failure"
            ? Response.json({ code: "project_busy" }, { status: 409 })
            : Response.json({ sessionId: "new", workspaceId }),
        );
      });
      expect(useWorkspace.getState().drafts.old).toBe("Keep draft");
      expect(button.hasAttribute("disabled")).toBe(false);
      if (scenario === "failure") {
        expect(ui.getByRole("alert")).toBeTruthy();
        expect(useWorkspace.getState().active).toEqual(active);
      } else {
        expect(useWorkspace.getState().active).toEqual({ id: "new", workspaceId });
        expect(useWorkspace.getState().draftProjects.new).toBe(workspaceId);
        expect(useWorkspace.getState().drafts.new).toBeUndefined();
        expect(useWorkspace.getState().sidebar).toBe(false);
      }
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(state, true);
      await i18n.changeLanguage(language);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
