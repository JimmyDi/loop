import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { useTheme } from "../../state/theme-store";
import { AppearanceSettings } from "./AppearanceSettings";

test("Appearance applies and persists choices, retaining selection when reopened", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const language = i18n.language;
  const theme = useTheme.getState().theme;

  Object.assign(globalThis, { window, document: window.document });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: window.localStorage,
  });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");

  try {
    await i18n.changeLanguage("en");
    useTheme.setState({ theme: "system" });
    const view = render(<AppearanceSettings />);

    expect(view.getByRole("group", { name: "Theme" })).toBeTruthy();
    expect(view.getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual([
      "system",
      "light",
      "dark",
    ]);
    expect((view.getByRole("radio", { name: "System" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(view.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("loop.web.theme")).toBe(JSON.stringify("dark"));
    view.unmount();
    const reopened = render(<AppearanceSettings />);

    expect((reopened.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(reopened.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(reopened.getByRole("radio", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(window.localStorage.getItem("loop.web.theme")).toBe(JSON.stringify("system"));
    await act(() => i18n.changeLanguage("zh"));
    expect(reopened.getByRole("group", { name: "主题" })).toBeTruthy();
    expect((reopened.getByRole("radio", { name: "跟随系统" }) as HTMLInputElement).checked).toBe(
      true,
    );
  } finally {
    cleanup();
    useTheme.setState({ theme });
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    await window.happyDOM.close();
  }
});
