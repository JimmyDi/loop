import { setImmediate } from "node:timers/promises";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

vi.mock("../layout/AppShell", () => ({ AppShell: () => null }));
vi.mock("@openuidev/devtools", () => ({
  OpenUIDevtools: () => <button type="button">OpenUI inspector</button>,
}));

test("local Debug settings toggle the inspector and restore the saved choice", async () => {
  const window = new Window({ url: "http://localhost" });
  const previous = { window: globalThis.window, document: globalThis.document };
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.assign(globalThis, { window, document: window.document });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: window.localStorage,
  });
  vi.stubEnv("LOOP_ENVIRONMENT", "local-dev");
  const { render, fireEvent, cleanup, act, waitFor } = await import("@testing-library/react/pure");

  try {
    const [{ App }, { SettingsPanel }, { i18n }] = await Promise.all([
      import("../../App"),
      import("./SettingsPanel"),
      import("../../i18n/setup"),
    ]);
    await i18n.changeLanguage("en");
    const app = render(<App />);
    const settings = render(<SettingsPanel initialSection="debug" onClose={() => {}} />);
    const toggle = settings.getByRole("switch", { name: "OpenUI DevTools" }) as HTMLInputElement;
    expect(settings.getByRole("tab", { name: "Debug" }).getAttribute("aria-selected")).toBe("true");
    expect(toggle.checked).toBe(true);
    await waitFor(() => expect(app.getByRole("button", { name: "OpenUI inspector" })).toBeTruthy());

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(app.queryByRole("button", { name: "OpenUI inspector" })).toBeNull();
    expect(window.localStorage.getItem("loop.web.openUiDevtools")).toBe("false");

    fireEvent.click(toggle);
    await waitFor(() => expect(app.getByRole("button", { name: "OpenUI inspector" })).toBeTruthy());
    fireEvent.click(toggle);
    cleanup();
    vi.resetModules();
    const { useDebug } = await import("../../state/debug-store");
    expect(useDebug.getState().openUiDevtools).toBe(false);
  } finally {
    await act(async () => {
      cleanup();
      await setImmediate();
    });
    vi.unstubAllEnvs();
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
