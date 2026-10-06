import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { PromptDuration } from "./PromptDuration";

test("elapsed duration switches to minutes while working and freezes at the recorded finish", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  let now = 7000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  let tick = () => {};
  const interval = vi.spyOn(window, "setInterval").mockImplementation(((callback: () => void) => {
    tick = callback;
    return 1;
  }) as unknown as typeof window.setInterval);
  const clear = vi.spyOn(window, "clearInterval");
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const ui = render(<PromptDuration timing={{ userMessageIndex: 0, startedAt: 1000 }} />);
    expect(ui.container.textContent).toBe("Working for 6s");
    await act(async () => {
      now = 8000;
      tick();
    });
    expect(ui.container.textContent).toBe("Working for 7s");
    for (const [seconds, duration] of [
      [59, "59s"],
      [60, "1m 0s"],
      [61, "1m 1s"],
      [125, "2m 5s"],
    ] as const) {
      await act(async () => {
        now = 1000 + seconds * 1000;
        tick();
      });
      expect(ui.container.textContent).toBe(`Working for ${duration}`);
    }
    ui.rerender(
      <PromptDuration timing={{ userMessageIndex: 0, startedAt: 1000, finishedAt: 366000 }} />,
    );
    expect(ui.container.textContent).toBe("Worked for 6m 5s");
    expect(clear).toHaveBeenCalledWith(1);
    await act(async () => {
      now = 90000;
      tick();
    });
    expect(ui.container.textContent).toBe("Worked for 6m 5s");
    for (const [elapsedMs, duration] of [
      [-1000, "0s"],
      [59999, "59s"],
      [60000, "1m 0s"],
      [61000, "1m 1s"],
      [125000, "2m 5s"],
      [3600000, "60m 0s"],
    ] as const) {
      ui.rerender(
        <PromptDuration
          timing={{ userMessageIndex: 0, startedAt: 1000, finishedAt: 1000 + elapsedMs }}
        />,
      );
      expect(ui.container.textContent).toBe(`Worked for ${duration}`);
    }
  } finally {
    cleanup();
    interval.mockRestore();
    clear.mockRestore();
    clock.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
