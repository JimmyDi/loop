import { vi, expect, test } from "vitest";
import { Window } from "happy-dom";

import { createMermaidCopyButton } from "./mermaid-copy";

test("Mermaid copy shows independent checks for 3 seconds and cleans up stale work", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  };
  Object.assign(globalThis, { window, document: window.document });
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const setTimer = vi.spyOn(window, "setTimeout").mockImplementation(((
    run: () => void,
    delay: number,
  ) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, run });
    return id;
  }) as unknown as typeof window.setTimeout);
  const clearTimer = vi.spyOn(window, "clearTimeout").mockImplementation((id) => {
    timers.delete(id as unknown as number);
  });
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of timers) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.run();
      }
    }
  };
  const pending: { text: string; resolve: () => void; reject: () => void }[] = [];
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: (text: string) =>
          new Promise<void>((resolve, reject) => {
            pending.push({
              text,
              resolve,
              reject: () => reject(new Error("Clipboard unavailable")),
            });
          }),
      },
    },
  });
  const source = 'flowchart LR\n  A["<b>Start</b>"] --> B[End]\n';
  const first = createMermaidCopyButton(source, {
    copy: "Copy Mermaid source",
    copied: "Copied",
    failed: "Could not copy",
  });
  const second = createMermaidCopyButton("sequenceDiagram\nA->>B: Hello\n", {
    copy: "复制 Mermaid 源码",
    copied: "已复制",
    failed: "复制失败",
  });
  const parent = document.createElement("div");
  let bubbled = 0;
  parent.onclick = () => {
    bubbled++;
  };
  parent.append(first.button, second.button);
  document.body.append(parent);
  const complete = async (index: number, fail = false) => {
    if (fail) pending[index]!.reject();
    else pending[index]!.resolve();
    await Promise.resolve();
  };
  const status = (button: HTMLButtonElement) => button.dataset.copyStatus;

  try {
    first.button
      .querySelector("path")!
      .dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as MouseEvent);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.text).toBe(source);
    expect(bubbled).toBe(0);
    expect(status(first.button)).toBe("copy"); // No success before the clipboard resolves.
    await complete(0);
    expect(status(first.button)).toBe("copied");
    expect(first.button.querySelector("rect")).toBeNull();
    expect(first.button.querySelector("path")?.getAttribute("d")).toBe("m5 12 4 4L19 6");
    expect(first.button.title).toBe("Copied");
    expect(first.button.getAttribute("aria-label")).toBe("Copied");
    expect(first.button.querySelector('[role="status"]')?.textContent).toBe("Copied");
    expect(status(second.button)).toBe("copy");
    advance(2999);
    expect(status(first.button)).toBe("copied");
    advance(1);
    expect(status(first.button)).toBe("copy");
    expect(first.button.querySelector("rect")).not.toBeNull();
    expect(first.button.title).toBe("Copy Mermaid source");
    expect(first.button.querySelector('[role="status"]')?.textContent).toBe("");

    first.button.click();
    await complete(1);
    advance(2000);
    first.button.click();
    await complete(2);
    second.button.click();
    await complete(3);
    expect(second.button.title).toBe("已复制");
    advance(1000); // The earlier timer must not reset the repeated copy.
    expect(status(first.button)).toBe("copied");
    expect(status(second.button)).toBe("copied");
    advance(2000);
    expect(status(first.button)).toBe("copy");
    expect(status(second.button)).toBe("copy");

    first.button.click();
    await complete(4, true);
    expect(status(first.button)).toBe("failed");
    expect(first.button.querySelector("rect")).not.toBeNull();
    expect(first.button.title).toBe("Could not copy");
    advance(3000);
    expect(first.button.title).toBe("Copy Mermaid source");

    first.button.click();
    first.button.click();
    await complete(6);
    await complete(5, true); // A late failure cannot override the newer success.
    expect(status(first.button)).toBe("copied");
    expect(timers.size).toBe(1);
    first.dispose();
    expect(timers.size).toBe(0);
    second.button.click();
    second.dispose();
    await complete(7);
    expect(status(second.button)).toBe("copy");
    expect(timers.size).toBe(0);
  } finally {
    first.dispose();
    second.dispose();
    parent.remove();
    setTimer.mockRestore();
    clearTimer.mockRestore();
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    if (previous.navigator) Object.defineProperty(globalThis, "navigator", previous.navigator);
    await window.happyDOM.close();
  }
});
