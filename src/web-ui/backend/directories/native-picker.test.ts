import { expect, test } from "bun:test";

import { createNativePicker, directoryCapabilities } from "./native-picker";

test("native picker is restricted to local macOS; SSH and other systems browse", () => {
  expect(directoryCapabilities("darwin", {})).toEqual({ native: true, preferred: "native" });
  expect(directoryCapabilities("darwin", { SSH_TTY: "session" }).preferred).toBe("browse");
  expect(directoryCapabilities("linux", {}).native).toBe(false);
  expect(directoryCapabilities("win32", {}).native).toBe(false);
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
