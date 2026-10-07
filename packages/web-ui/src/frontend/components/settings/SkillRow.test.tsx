import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient } from "@tanstack/react-query";

import { i18n } from "../../i18n/setup";
import { SkillRow } from "./SkillRow";

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

test("SkillRow interaction preserves the skill workflow", async () => {
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
    const open = vi.fn();
    const toggle = vi.fn();
    const view = render(<SkillRow skill={skill} pending={false} onOpen={open} onToggle={toggle} />);
    fireEvent.click(view.getByRole("button", { name: "View example" }));
    fireEvent.click(view.getByRole("switch"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);
    view.rerender(
      <SkillRow
        skill={{ ...skill, error: "Invalid metadata" }}
        pending={false}
        onOpen={open}
        onToggle={toggle}
      />,
    );
    expect(view.getByRole("switch").hasAttribute("disabled")).toBe(true);
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
