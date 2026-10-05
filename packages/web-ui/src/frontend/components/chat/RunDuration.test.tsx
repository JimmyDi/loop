import { vi, expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";

import { i18n } from "../../i18n/setup";
import { RunDuration } from "./RunDuration";

test("elapsed time formats seconds, minutes and hours and keeps failure state visible", async () => {
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    for (const [seconds, text] of [
      [0, "0s"],
      [59, "59s"],
      [60, "1m 0s"],
      [1700, "28m 20s"],
      [3661, "1h 1m 1s"],
    ] as const) {
      expect(
        renderToStaticMarkup(
          <RunDuration
            status="success"
            timing={{ userMessageIndex: 0, startedAt: 1000, finishedAt: 1000 + seconds * 1000 }}
          />,
        ),
      ).toContain("Worked for " + text);
    }
    expect(
      renderToStaticMarkup(
        <RunDuration
          status="error"
          timing={{ userMessageIndex: 0, startedAt: 1000, finishedAt: 2000 }}
        />,
      ),
    ).toContain("Worked for 1s · Error");
    expect(renderToStaticMarkup(<RunDuration status="success" />)).toContain("Work completed");
    expect(
      renderToStaticMarkup(
        <RunDuration status="idle" timing={{ userMessageIndex: 0, startedAt: 1000 }} />,
      ),
    ).toContain("Execution details");
    await i18n.changeLanguage("zh");
    expect(
      renderToStaticMarkup(
        <RunDuration
          status="cancelled"
          timing={{ userMessageIndex: 0, startedAt: 1000, finishedAt: 1701000 }}
        />,
      ),
    ).toContain("工作了 28 分 20 秒 · 已取消");
  } finally {
    await i18n.changeLanguage(language);
  }
});

test("timer updates while running, stops at server completion, and cleans up on unmount", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  let now = 1000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  const callbacks = new Map<number, () => void>();
  let id = 0;
  window.setInterval = ((callback: () => void) => {
    callbacks.set(++id, callback);
    return id;
  }) as unknown as typeof window.setInterval;
  window.clearInterval = ((key: number) => {
    callbacks.delete(key);
  }) as unknown as typeof window.clearInterval;
  const timing = { userMessageIndex: 0, startedAt: 1000 };
  try {
    const ui = render(<RunDuration status="running" timing={timing} />);
    expect(ui.container.textContent).toBe("Working for 0s");
    expect(callbacks.size).toBe(1);
    now = 63000;
    await act(() => {
      for (const callback of callbacks.values()) callback();
    });
    expect(ui.container.textContent).toBe("Working for 1m 2s");
    ui.rerender(<RunDuration status="success" timing={{ ...timing, finishedAt: 64500 }} />);
    expect(ui.container.textContent).toBe("Worked for 1m 3s");
    expect(callbacks.size).toBe(0);
    now = 999999;
    ui.rerender(<RunDuration status="success" timing={{ ...timing, finishedAt: 64500 }} />);
    expect(ui.container.textContent).toBe("Worked for 1m 3s");
    ui.rerender(<RunDuration status="running" timing={{ userMessageIndex: 4, startedAt: now }} />);
    expect(ui.container.textContent).toBe("Working for 0s");
    ui.unmount();
    expect(callbacks.size).toBe(0);
  } finally {
    cleanup();
    clock.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
