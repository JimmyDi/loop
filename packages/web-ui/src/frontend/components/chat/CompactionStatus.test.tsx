import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { i18n } from "../../i18n/setup";
import { CompactionStatus } from "./CompactionStatus";

test("compaction shows elapsed work, delayed guidance and a theme-neutral completed row", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  let now = 6000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  let tick = () => {};
  vi.spyOn(window, "setInterval").mockImplementation(((callback: () => void) => {
    tick = callback;
    return 1;
  }) as unknown as typeof window.setInterval);
  const clear = vi.spyOn(window, "clearInterval");
  const language = i18n.language;
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    await i18n.changeLanguage("en");
    const view = render(<CompactionStatus running startedAt={1000} />);
    expect(view.getByText("Working for 5s")).toBeTruthy();
    expect(view.getByRole("status").textContent).toBe("Compacting context");
    act(() => {
      now = 15000;
      tick();
    });
    expect(view.getByRole("status").textContent).not.toContain("few minutes");
    act(() => {
      now = 16000;
      tick();
    });
    expect(view.getByRole("status").textContent).toContain("This can take a few minutes");
    view.rerender(<CompactionStatus running startedAt={1000} connected={false} />);
    expect(view.queryByText(/Working for/)).toBeNull();
    expect(clear).toHaveBeenCalledWith(1);
    view.rerender(<CompactionStatus running startedAt={1000} />);
    expect(view.getByText("Working for 15s")).toBeTruthy();
    view.rerender(<CompactionStatus />);
    expect(view.getByRole("status").textContent).toBe("Context compacted");
    expect(view.queryByText(/Working for/)).toBeNull();
    await act(() => i18n.changeLanguage("zh"));
    expect(view.getByRole("status").textContent).toBe("上下文已压缩");
  } finally {
    cleanup();
    vi.restoreAllMocks();
    Object.assign(globalThis, previous);
    await i18n.changeLanguage(language);
    await window.happyDOM.close();
  }
});
