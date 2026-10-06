import { expect, test } from "vitest";

import { createNativePicker, nativePickerAvailable } from "./native-picker";

test("native picker is available only on local macOS", () => {
  expect(nativePickerAvailable("darwin", {})).toBe(true);
  expect(nativePickerAvailable("darwin", { SSH_TTY: "session" })).toBe(false);
  expect(nativePickerAvailable("darwin", { SSH_CONNECTION: "connection" })).toBe(false);
  expect(nativePickerAvailable("linux", {})).toBe(false);
  expect(nativePickerAvailable("win32", {})).toBe(false);
});

test("native picker treats cancellation as no selection and rejects concurrent windows", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pick = createNativePicker(
    async () => {
      await wait;
      return { code: 1, output: "", error: "User canceled (-128)" };
    },
    () => true,
  );
  const first = pick(new AbortController().signal);

  await expect(pick(new AbortController().signal)).rejects.toThrow("picker_busy");
  release();
  expect(await first).toBeNull();
  const controller = new AbortController();

  controller.abort();
  await expect(pick(controller.signal)).rejects.toThrow();
});
