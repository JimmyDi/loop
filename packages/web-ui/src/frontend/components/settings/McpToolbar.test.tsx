import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { McpToolbar } from "./McpToolbar";

test("toolbar is controlled and emits search changes without changing its server count", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const onSearch = vi.fn();
  try {
    await i18n.changeLanguage("en");
    const view = render(<McpToolbar count={3} search="example" onSearch={onSearch} />);
    expect(view.getByText("3")).toBeTruthy();
    expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("example");
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "other" } });
    expect(onSearch).toHaveBeenCalledWith("other");
    view.rerender(<McpToolbar count={3} search="other" onSearch={onSearch} />);
    expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("other");
    expect(view.getByText("3")).toBeTruthy();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
