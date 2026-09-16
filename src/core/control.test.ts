import { expect, test } from "bun:test";
import { RunController } from "./control";

test("controller cancels and toggles pause state", () => {
  const controller = new RunController();
  expect(controller.isPaused).toBe(false);
  controller.pause();
  expect(controller.isPaused).toBe(true);
  controller.resume();
  expect(controller.isPaused).toBe(false);
  controller.cancel();
  expect(controller.abortController.signal.aborted).toBe(true);
});
