import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { PlanResultCard } from "./PlanResultCard";
import { PlanPanelContext } from "../../lib/plan-panel-context";
import { i18n } from "../../i18n/setup";

test("preview opens the selected version by click and keyboard without rendering the full plan", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const selected: string[] = [];
    const plan = {
      id: "old",
      version: 1,
      title: "Original",
      markdown: "Preview " + "x".repeat(4100) + "TAIL",
      status: "superseded" as const,
    };
    const view = render(
      <PlanPanelContext value={(id) => selected.push(id)}>
        <PlanResultCard plan={plan} />
      </PlanPanelContext>,
    );
    expect(view.container.textContent).not.toContain("TAIL");
    fireEvent.click(view.getByRole("button", { name: "Open plan" }));
    fireEvent.keyDown(view.getByRole("button", { name: "Open plan: Original" }), { key: "Enter" });
    expect(selected).toEqual(["old", "old"]);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
