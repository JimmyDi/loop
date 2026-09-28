import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { useComposerImages } from "./useComposerImages";
import { useWorkspace } from "../state/workspace-store";

test("attachment reads preserve drafts, reject invalid files and exclude duplicate reads", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    FileReader: globalThis.FileReader,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document, FileReader: window.FileReader });
  const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
  try {
    useWorkspace.setState({ images: {}, drafts: { test: "Keep" } });
    const { result } = renderHook(() => useComposerImages("test"));
    const file = new window.File(["image"], "test.png", { type: "image/png" }) as unknown as File;
    await act(async () => {
      await Promise.all([result.current.add([file]), result.current.add([file])]);
    });
    expect(useWorkspace.getState().images.test).toEqual([
      { type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
    ]);
    expect(useWorkspace.getState().drafts.test).toBe("Keep");
    await act(() => result.current.add([new File(["bad"], "bad.svg", { type: "image/svg+xml" })]));
    expect(result.current.error).toMatchObject({ code: "invalid_images" });
    expect(useWorkspace.getState().images.test).toHaveLength(1);
    act(() => result.current.remove(0));
    expect(useWorkspace.getState().images.test).toEqual([]);
  } finally {
    cleanup();
    useWorkspace.setState(workspace);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
