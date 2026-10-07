import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import type { SkillSummary } from "../../../shared/skills";
import { InstalledSkills } from "./InstalledSkills";

test("Installed previews six, expands and collapses, and routes project actions to their source", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const skills: SkillSummary[] = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1).repeat(24),
    name: "example-" + index,
    handle: "example-" + index,
    description: "Review source",
    path: "skills/example-" + index + "/SKILL.md",
    enabled: true,
    managed: true,
    modelInvocable: true,
    scope: index < 4 ? "personal" : "project",
    source: { kind: "created" },
  }));
  const projects = [{ id: "project-one", name: "Example", cwd: "fixtures/example" }];
  client.setQueryData(["skills", "personal"], { skills: skills.slice(0, 4), discovering: false });
  client.setQueryData(["skills", "project-one"], { skills, discovering: false });
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PATCH") return Response.json({});
    if (url.includes("/" + skills[7]!.id))
      return Response.json({ ...skills[7], content: "Read the source." });
    return Response.json({
      skills: url.includes("workspaceId") ? skills : skills.slice(0, 4),
      discovering: false,
    });
  });
  globalThis.fetch = fetch;
  try {
    await i18n.changeLanguage("en");
    const update = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <InstalledSkills projects={projects} search="" onUpdate={update} />
      </QueryClientProvider>,
    );
    expect(view.getByRole("region", { name: "Installed" })).toBeTruthy();
    expect(view.getAllByRole("switch")).toHaveLength(6);
    expect(view.queryByText("example-6")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Show more" }));
    expect(view.getAllByRole("switch")).toHaveLength(8);
    expect(view.queryByRole("button", { name: "Show more" })).toBeNull();
    const collapse = view.getByRole("button", { name: "Show less" });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(collapse);
    expect(view.getAllByRole("switch")).toHaveLength(6);
    expect(view.queryByText("example-6")).toBeNull();
    expect(view.getByRole("button", { name: "Show more" })).toBe(collapse);
    expect(collapse.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(collapse);
    expect(view.getAllByRole("switch")).toHaveLength(8);
    await act(async () => fireEvent.click(view.getByRole("switch", { name: "Enable example-7" })));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/" + skills[7]!.id + "/enabled?workspaceId=project-one"),
      expect.objectContaining({ method: "PATCH" }),
    );
    await act(async () => fireEvent.click(view.getByRole("button", { name: "View example-7" })));
    expect(view.getByRole("dialog", { name: "example-7" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    view.rerender(
      <QueryClientProvider client={client}>
        <InstalledSkills projects={projects} search="EXAMPLE-7" onUpdate={update} />
      </QueryClientProvider>,
    );
    expect(view.getAllByRole("switch")).toHaveLength(1);
    expect(view.getByText("example-7")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Show less" })).toBeNull();
    await act(async () =>
      client.setQueryData(["skills", "project-one"], { skills: [], discovering: false }),
    );
    await waitFor(() => expect(view.getByText("No matching skills.")).toBeTruthy());
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
