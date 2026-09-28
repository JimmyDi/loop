import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { useComposerAttachments } from "./useComposerAttachments";
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
    useWorkspace.setState({ images: {}, files: {}, drafts: { test: "Keep" } });
    const { result } = renderHook(() => useComposerAttachments("test"));
    const file = new window.File(["image"], "test.png", { type: "image/png" }) as unknown as File;
    await act(async () => {
      await Promise.all([result.current.add([file]), result.current.add([file])]);
    });
    expect(useWorkspace.getState().images.test).toEqual([
      { type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
    ]);
    expect(useWorkspace.getState().drafts.test).toBe("Keep");
    await act(() => result.current.add([new File(["bad"], "bad.svg", { type: "image/svg+xml" })]));
    expect(result.current.error).toMatchObject({ code: "invalid_text_files" });
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

test("mixed selections are atomic and text reads remain owned by the starting session", async () => {
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
    useWorkspace.setState({ images: {}, files: {}, drafts: { first: "Keep" } });
    const { result, rerender } = renderHook(({ id }) => useComposerAttachments(id), {
      initialProps: { id: "first" },
    });
    const image = new window.File(["image"], "example.png", {
      type: "image/png",
    }) as unknown as File;
    await act(() => result.current.add([image, new File([new Uint8Array([0])], "bad.txt")]));
    expect(result.current.error).toMatchObject({ code: "invalid_text_encoding" });
    expect(useWorkspace.getState().images.first).toBeUndefined();
    expect(useWorkspace.getState().files.first).toBeUndefined();
    await act(() => result.current.add([image, new File(["const x = 1;"], "example.ts")]));
    expect(useWorkspace.getState().images.first).toHaveLength(1);
    expect(useWorkspace.getState().files.first).toEqual([
      { name: "example.ts", text: "const x = 1;" },
    ]);

    let finish!: (buffer: ArrayBuffer) => void;
    const file = new File([], "delayed.txt");
    Object.defineProperty(file, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finish = resolve;
        }),
    });
    let reading!: Promise<void>;
    act(() => {
      reading = result.current.add([file]);
    });
    expect(result.current.pending).toBe(true);
    rerender({ id: "second" });
    await act(async () => {
      finish(new TextEncoder().encode("Delayed").buffer);
      await reading;
    });
    expect(useWorkspace.getState().files.first).toHaveLength(2);
    expect(useWorkspace.getState().files.second).toBeUndefined();
    rerender({ id: "first" });
    act(() => result.current.removeFile(0));
    expect(useWorkspace.getState().files.first).toEqual([{ name: "delayed.txt", text: "Delayed" }]);
    expect(useWorkspace.getState().drafts.first).toBe("Keep");
    await act(() =>
      result.current.add([
        new File(["a".repeat(1024 * 1024)], "one.txt"),
        new File(["中".repeat(512 * 1024)], "two.txt"),
      ]),
    );
    expect(result.current.error).toBeUndefined();
    expect(useWorkspace.getState().files.first).toHaveLength(3);
    expect(useWorkspace.getState().files.first?.[2]?.text).toBe("中".repeat(512 * 1024));
  } finally {
    cleanup();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
