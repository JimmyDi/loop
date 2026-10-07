import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { ComposerSkills } from "./ComposerSkills";
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

test("ComposerSkills interaction preserves the skill workflow", async () => {
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
  try {
    await i18n.changeLanguage("en");
    useWorkspace.setState({ skills: {} });
    client.setQueryData(["skills", "project"], { skills: [skill], discovering: false });
    const onText = vi.fn();
    const submit = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <form>
          <div role="textbox" onKeyDown={submit} />
          <ComposerSkills
            sessionId="session"
            workspaceId="project"
            text="Please $ex"
            disabled={false}
            onText={onText}
          />
        </form>
      </QueryClientProvider>,
    );
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    expect(submit).not.toHaveBeenCalled();
    expect(onText).toHaveBeenCalledWith("Please ");
    expect(useWorkspace.getState().skills.session?.[0]?.id).toBe(skill.id);
    await act(async () => {});
    expect(view.container.querySelector(".composer-skill-pill")).toBeNull();
    client.setQueryData(["skills", "project"], { skills: [], discovering: true });
    await waitFor(() => expect(view.getByText("Finding skills…")).toBeTruthy());
    expect(view.queryByText("No skills yet")).toBeNull();
    client.setQueryData(["skills", "project"], { skills: [], discovering: false });
    await waitFor(() => expect(view.getByText("No skills yet")).toBeTruthy());
    expect(view.getByText("Add skills to get started.")).toBeTruthy();
    expect(view.queryByText("No matching skills")).toBeNull();
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    expect(submit).not.toHaveBeenCalled();
    expect(onText).toHaveBeenCalledTimes(1);
    client.setQueryData(["skills", "project"], {
      skills: [{ ...skill, enabled: false }],
      discovering: false,
    });
    await waitFor(() => expect(view.getByText("No enabled skills")).toBeTruthy());
    client.setQueryData(["skills", "project"], {
      skills: [{ ...skill, name: "other", description: "Other workflow" }],
      discovering: false,
    });
    await waitFor(() => expect(view.getByText("No matching skills")).toBeTruthy());
    expect(view.getByText(/Try another name/)).toBeTruthy();
    client.setQueryData(["skills", "project"], {
      skills: [],
      discovering: false,
      error: "Synthetic discovery error",
    });
    await waitFor(() =>
      expect(view.getByRole("alert").textContent).toContain("Synthetic discovery error"),
    );
    expect(view.queryByText("No skills yet")).toBeNull();
    expect(view.queryByText("No matching skills")).toBeNull();
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
