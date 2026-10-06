import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { JumpToLatestButton } from "./JumpToLatestButton";

test("the running dots and idle arrow both jump to latest without changing button identity", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const jump = vi.fn();

  try {
    const ui = render(<JumpToLatestButton running onClick={jump} />);
    const button = ui.getByRole("button", { name: "Jump to latest" });
    expect(button.getAttribute("title")).toBe("Jump to latest");
    expect(button.querySelectorAll(".jump-latest-dots > span")).toHaveLength(3);
    expect(button.querySelector(".jump-latest-dots")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(button);
    expect(jump).toHaveBeenCalledTimes(1);

    ui.rerender(<JumpToLatestButton running={false} onClick={jump} />);
    expect(ui.getByRole("button", { name: "Jump to latest" })).toBe(button);
    expect(button.querySelector(".jump-latest-dots")).toBeNull();
    expect(button.querySelector("path")?.getAttribute("d")).toBe("M12 5v14m-6-6 6 6 6-6");
    fireEvent.click(button);
    expect(jump).toHaveBeenCalledTimes(2);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
