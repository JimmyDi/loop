import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { SessionPlans } from "./SessionPlans";
import type { SessionSnapshot } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";

test("renders ready and historical plan bodies without duplicate review actions", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const snapshot = {
      sessionId: "s",
      operation: "idle",
      state: {
        isRunning: false,
        planning: {
          mode: "plan",
          plans: [
            { id: "old", version: 1, title: "Old", markdown: "Prior plan", status: "superseded" },
            {
              id: "new",
              version: 2,
              title: "Current",
              markdown: "## Approach\nImplement the change.",
              status: "ready",
            },
          ],
        },
      },
    } as SessionSnapshot;
    const view = render(<SessionPlans plans={snapshot.state.planning!.plans} />);
    expect(view.getByText("Implement the change.")).toBeTruthy();
    expect(view.container.querySelectorAll(".plan-result-card")).toHaveLength(2);
    expect(view.getAllByRole("button", { name: "Open plan" })).toHaveLength(2);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
