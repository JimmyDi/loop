import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { SkillInstallForm } from "./SkillInstallForm";
import type { useSkills } from "../../hooks/useSkills";

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

test("SkillInstallForm interaction preserves the skill workflow", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  try {
    await i18n.changeLanguage("en");
    const candidate = {
      key: "created",
      name: skill.name,
      description: skill.description,
      content: skill.content,
      files: ["SKILL.md"],
    };
    const api = {
      cancel: vi.fn(async () => {}),
      preview: vi.fn(async () => ({
        id: "job",
        status: "ready" as const,
        stage: "checking" as const,
        candidates: [candidate],
      })),
      install: vi.fn(async () => {
        throw new Error("Synthetic installation failed");
      }),
    } as unknown as ReturnType<typeof useSkills>;
    const close = vi.fn();
    const view = render(
      <div className="settings-content">
        <SkillInstallForm kind="created" api={api} hasProject={false} onClose={close} />
      </div>,
    );
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "example" } });
    fireEvent.change(view.getByLabelText("When to use"), { target: { value: "Review source" } });
    fireEvent.change(view.getByLabelText("Instructions"), {
      target: { value: "Review the source." },
    });
    const container = view.container.firstElementChild as HTMLElement;
    container.scrollTop = 240;
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(view.getByRole("button", { name: "Install" })).toBeTruthy();
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "changed" } });
    expect(view.queryByRole("button", { name: "Install" })).toBeNull();
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(view.getByText("Synthetic installation failed")).toBeTruthy();
    expect((view.getByLabelText("Name") as HTMLInputElement).value).toBe("changed");
    expect(container.scrollTop).toBe(240);
    expect(close).not.toHaveBeenCalled();
    const install = vi.fn(async () => ({}));
    view.rerender(
      <SkillInstallForm
        key="project"
        kind="created"
        api={{ ...api, install }}
        hasProject
        projectName="Example"
        initialScope="project"
        initial={{ id: "project-job", status: "ready", stage: "checking", candidates: [candidate] }}
        onClose={close}
      />,
    );
    expect((view.getByLabelText("Install to") as HTMLSelectElement).value).toBe("project");
    expect(view.getByRole("option", { name: "Project · Example" })).toBeTruthy();
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(install).toHaveBeenCalledWith("project-job", ["created"], "project", undefined);
    expect(close).toHaveBeenLastCalledWith("project");
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
