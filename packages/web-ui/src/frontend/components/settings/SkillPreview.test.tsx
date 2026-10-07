import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { SkillPreview } from "./SkillPreview";

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

test("SkillPreview interaction preserves the skill workflow", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    Element: globalThis.Element,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document, Element: window.Element });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  try {
    await i18n.changeLanguage("en");
    const select = vi.fn();
    const view = render(
      <SkillPreview
        job={{
          id: "job",
          status: "ready",
          stage: "checking",
          candidates: [
            {
              key: "example",
              name: skill.name,
              description: skill.description,
              content: skill.content,
              files: ["SKILL.md", "references/guide.md"],
            },
          ],
        }}
        selected={["example"]}
        onSelect={select}
      />,
    );
    expect(view.getByText("Review the source.")).toBeTruthy();
    expect(view.getByText(/references\/guide.md/)).toBeTruthy();
    fireEvent.click(view.getByRole("checkbox"));
    expect(select).toHaveBeenCalledWith([]);
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
