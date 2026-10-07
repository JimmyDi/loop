import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { SkillsSettings } from "./SkillsSettings";
import { useWorkspace } from "../../state/workspace-store";

const skill = {
  id: "a".repeat(24),
  name: "example",
  handle: "example-" + "a".repeat(24),
  description: "Review source",
  path: "skills/example/SKILL.md",
  enabled: true,
  modelInvocable: true,
  managed: true,
  scope: "personal" as const,
  source: { kind: "created" as const },
  content: "Review the source.",
};

test("SkillsSettings interaction preserves the skill workflow", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup, act, waitFor, within } = await import(
    "@testing-library/react/pure"
  );
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  try {
    await i18n.changeLanguage("en");
    useWorkspace.setState({ active: undefined });
    client.setQueryData(["skills", "personal"], { skills: [skill], discovering: false });
    const projectSkill = { ...skill, id: "b".repeat(24), name: "project-review", scope: "project" };
    const otherSkill = { ...projectSkill, id: "c".repeat(24), name: "other-review" };
    const projects = [
      { id: "project-one", name: "Example", cwd: "fixtures/example" },
      { id: "project-two", name: "Other", cwd: "fixtures/other" },
    ];
    client.setQueryData(["projects"], projects);
    client.setQueryData(["skills", "project-one"], {
      skills: [skill, projectSkill],
      discovering: false,
    });
    client.setQueryData(["skills", "project-two"], {
      skills: [skill, otherSkill],
      discovering: false,
    });
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/enabled")) return Response.json({});
      if (url.includes("/" + skill.id)) return Response.json(skill);
      if (url.includes("workspaceId=project-one"))
        return Response.json({ skills: [skill, projectSkill], discovering: false });
      if (url.includes("workspaceId=project-two"))
        return Response.json({ skills: [skill, otherSkill], discovering: false });
      return Response.json({ skills: [skill], discovering: false });
    });
    globalThis.fetch = fetch;
    const view = render(
      <QueryClientProvider client={client}>
        <SkillsSettings />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(view.getByRole("tab", { name: "Personal" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
    const list = () =>
      within(view.container.querySelector<HTMLElement>(".skills-settings > .skill-list")!);
    expect(list().queryByText("project-review")).toBeNull();
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "example" } });
    view.container.scrollTop = 180;
    const row = list().getByRole("button", { name: "View example" });
    row.focus();
    await act(async () => fireEvent.click(row));
    expect(view.getByRole("dialog", { name: "example" }).parentElement).toBe(document.body);
    expect(list().getByRole("button", { name: "View example" })).toBe(row);
    expect(view.container.querySelector(".skill-list")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(view.queryByRole("dialog", { name: "example" })).toBeNull();
    expect(document.activeElement).toBe(row);
    expect(view.container.scrollTop).toBe(180);
    expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("example");
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(view.getByRole("tab", { name: "Example" }));
    expect(list().queryByText("example")).toBeNull();
    expect(list().getByText("project-review")).toBeTruthy();
    await act(async () => fireEvent.click(list().getByRole("switch")));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/" + projectSkill.id + "/enabled?workspaceId=project-one"),
      expect.objectContaining({ method: "PATCH" }),
    );
    fireEvent.click(view.getByRole("tab", { name: "Other" }));
    expect(list().getByText("other-review")).toBeTruthy();
    expect(list().queryByText("project-review")).toBeNull();
    fireEvent.click(view.getByRole("tab", { name: "Personal" }));
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "missing" } });
    expect(view.queryByText("example")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Add/ }));
    fireEvent.click(view.getByRole("menuitem", { name: "Create skill" }));
    expect(view.getByLabelText("Name")).toBeTruthy();
    expect(view.getByText("Manage Skills")).toBeTruthy();
    expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("missing");
    expect((view.getByLabelText("Install to") as HTMLSelectElement).value).toBe("personal");
    expect(view.getByRole("tab", { name: "Example" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: /Cancel/ }));
    await act(async () => {});
    fireEvent.click(view.getByRole("tab", { name: "Example" }));
    fireEvent.click(view.getByRole("button", { name: /Add/ }));
    fireEvent.click(view.getByRole("menuitem", { name: "Create skill" }));
    expect((view.getByLabelText("Install to") as HTMLSelectElement).value).toBe("project");
    expect(view.getByRole("option", { name: "Project · Example" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Cancel/ }));
    await act(async () => {});
    await act(async () => client.setQueryData(["projects"], []));
    await waitFor(() =>
      expect(view.getByRole("tab", { name: "Personal" }).getAttribute("aria-selected")).toBe(
        "true",
      ),
    );
  } finally {
    await act(async () => {
      cleanup();
      client.clear();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
