import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { PlanModeItem } from "./PlanModeItem";
import { i18n } from "../../i18n/setup";

test("Plan chip cancels only while idle and hides when inactive", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    let next = true;
    const change = (active: boolean) => {
      next = active;
    };
    const view = render(<PlanModeItem active disabled={false} change={change} />);
    fireEvent.click(view.getByRole("button", { name: "Turn off Plan mode" }));
    expect(next).toBe(false);
    view.rerender(<PlanModeItem active disabled change={change} />);
    expect((view.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<PlanModeItem active={false} disabled={false} change={change} />);
    expect(view.queryByRole("button")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
