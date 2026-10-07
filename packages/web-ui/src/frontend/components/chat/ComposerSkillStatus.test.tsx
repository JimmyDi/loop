import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { ComposerSkillStatus } from "./ComposerSkillStatus";

test("skill status provides localized guidance for an empty catalog", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  try {
    await i18n.changeLanguage("zh");
    const view = render(<ComposerSkillStatus state="empty" />);
    expect(view.getByRole("status").textContent).toContain("暂无技能");
    expect(view.getByText("添加技能即可开始使用。")).toBeTruthy();
    expect(view.container.querySelector(".composer-skill-status-icon")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
