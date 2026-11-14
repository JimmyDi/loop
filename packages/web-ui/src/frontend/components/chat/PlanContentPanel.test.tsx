import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { PlanContentPanel } from "./PlanContentPanel";
import { i18n } from "../../i18n/setup";

test("panel displays the complete selected version without altering the plan", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const plan = { id: "p", version: 2, title: "Revised", markdown: "Complete content" };
    const view = render(<PlanContentPanel plan={plan} />);
    expect(view.getByText("Complete content")).toBeTruthy();
    expect(plan.markdown).toContain("Complete content");
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
