// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import "../../i18n/setup";
import Countdown from "./Countdown";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("starts, pauses, finishes and resets a local countdown", () => {
  vi.useFakeTimers();
  const ui = render(<Countdown title="Rest" seconds={3} />);
  const start = ui.getByRole("button", { name: "Start" });
  expect(start.classList.contains("openui-button-base-primary")).toBe(true);
  expect(
    ui.getByRole("button", { name: "Reset" }).classList.contains("openui-button-base-secondary"),
  ).toBe(true);
  fireEvent.click(start);
  act(() => vi.advanceTimersByTime(1100));
  expect(ui.getByRole("timer").textContent).toBe("00:00:02");
  fireEvent.click(ui.getByRole("button", { name: "Pause" }));
  act(() => vi.advanceTimersByTime(5000));
  expect(ui.getByRole("timer").textContent).toBe("00:00:02");
  fireEvent.click(ui.getByRole("button", { name: "Start" }));
  act(() => vi.advanceTimersByTime(2000));
  expect(ui.getByRole("status").textContent).toBe("Time is up");
  fireEvent.click(ui.getByRole("button", { name: "Reset" }));
  expect(ui.getByRole("timer").textContent).toBe("00:00:03");
});
