import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import type { PwaState } from "../../pwa/pwa-client";

const mocked = vi.hoisted(() => ({
  state: { enabled: true, installed: false, offline: false } as PwaState,
  update: vi.fn(),
  install: vi.fn(async () => {}),
}));
vi.mock("../../pwa/pwa-client", () => ({
  getPwaState: () => mocked.state,
  subscribePwa: () => () => {},
  installPwa: mocked.install,
  updatePwa: mocked.update,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

test("install guidance, dismissal, explicit update and offline status", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    const { PwaStatus } = await import("./PwaStatus");
    const view = render(<PwaStatus />);
    fireEvent.click(view.getByText("pwa.instructions"));
    expect(view.getByText("pwa.help")).toBeTruthy();
    fireEvent.click(view.getByText("pwa.dismiss"));
    expect(view.container.textContent).toBe("");
    mocked.state = {
      ...mocked.state,
      waiting: { postMessage: vi.fn() } as unknown as ServiceWorker,
    };
    view.rerender(<PwaStatus />);
    expect(mocked.update).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("pwa.update"));
    expect(mocked.update).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByText("pwa.later"));
    expect(view.container.textContent).toBe("");
    mocked.state = { ...mocked.state, offline: true };
    view.rerender(<PwaStatus />);
    expect(view.getByRole("status").textContent).toBe("pwa.offline");
  } finally {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
