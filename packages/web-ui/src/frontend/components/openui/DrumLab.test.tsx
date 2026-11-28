// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import "../../i18n/setup";
import DrumLab from "./DrumLab";

const audio = vi.hoisted(() => ({
  context: {
    currentTime: 0,
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  },
  hit: vi.fn(),
}));
vi.mock("./drum-audio", () => ({ voices: ["kick", "snare", "hat"], createDrumAudio: () => audio }));

afterEach(() => {
  cleanup();
  audio.context.currentTime = 0;
  vi.clearAllMocks();
});

test("plays pads, edits a 16-step pattern and schedules active voices", async () => {
  const ui = render(<DrumLab title="Drums" tempo={120} />);
  expect(ui.getAllByRole("button", { name: /step/ })).toHaveLength(48);
  expect(audio.context.resume).not.toHaveBeenCalled();
  const kick = ui.getByRole("button", { name: "Kick step 1" });
  fireEvent.click(kick);
  expect(kick.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(kick);
  fireEvent.click(ui.getByRole("button", { name: "Snare" }));
  await waitFor(() => expect(audio.hit).toHaveBeenCalledWith("snare"));
  await act(async () => fireEvent.click(ui.getByRole("button", { name: "Play" })));
  await waitFor(() => expect(audio.hit).toHaveBeenCalledWith("kick", 0.04));
  audio.context.currentTime = 0.05;
  await waitFor(() => expect(kick.dataset.active).toBe("true"));
  fireEvent.click(ui.getByRole("button", { name: "Stop" }));
  expect(kick.dataset.active).toBeUndefined();
  ui.unmount();
  expect(audio.context.close).toHaveBeenCalledTimes(1);
});
