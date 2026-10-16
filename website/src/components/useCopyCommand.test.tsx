import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useCopyCommand } from "./useCopyCommand";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("does not select unrelated content when a clipboard request rejects after unmount", async () => {
  let rejectCopy: (reason: Error) => void = () => {};
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: () =>
        new Promise<void>((_, reject) => {
          rejectCopy = reject;
        }),
    },
  });
  const select = vi.spyOn(window, "getSelection");
  const { result, unmount } = renderHook(() => useCopyCommand("command"));
  const pending = result.current.copy();
  unmount();
  await act(async () => {
    rejectCopy(new Error("Unavailable"));
    await pending;
  });
  expect(select).not.toHaveBeenCalled();
  select.mockRestore();
});
