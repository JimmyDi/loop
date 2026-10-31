import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { holdHistoryPosition } from "./timeline-history-position";

test("holds the visible message despite unrelated growth below it and restores scrolling", async () => {
  const window = new Window();
  try {
    const element = window.document.createElement("div") as unknown as HTMLDivElement;
    element.innerHTML =
      '<div class="timeline-content"><article>Visible</article><article>Later</article></div>';
    const anchor = element.querySelector("article")!;
    let anchorY = 20;
    let height = 800;
    element.scrollTop = 50;
    element.style.overflowY = "auto";
    element.getBoundingClientRect = () => new window.DOMRect(0, 0, 100, 100);
    anchor.getBoundingClientRect = () => ({ top: anchorY, bottom: anchorY + 80 }) as DOMRect;
    Object.defineProperty(element, "scrollHeight", { get: () => height });
    const position = holdHistoryPosition(element);
    expect(element.style.overflowY).toBe("hidden");
    expect(element.style.touchAction).toBe("none");
    element.scrollTop = 100;
    position.freeze();
    expect(element.scrollTop).toBe(50);
    // Prepend adds 300px above the anchor; live output adds another 200px below it.
    anchorY += 300;
    height += 500;
    position.restore(true);
    expect(element.scrollTop).toBe(350);
    expect(element.style.overflowY).toBe("auto");
    expect(element.style.touchAction).toBe("");
    const failed = holdHistoryPosition(element);
    failed.restore(false);
    expect(element.scrollTop).toBe(350);
    expect(element.style.overflowY).toBe("auto");
  } finally {
    await window.happyDOM.close();
  }
});

test("virtual history restores the first mounted row after prepend rather than the list wrapper", () => {
  const window = new Window();
  const element = window.document.createElement("div");
  element.innerHTML =
    '<div class="timeline-content"><div class="virtual-list"><div class="virtual-spacer"></div><div class="virtual-row">Visible row</div></div></div>';
  const row = element.querySelector(".virtual-row")!;
  let rowTop = 30;
  element.getBoundingClientRect = () => new window.DOMRect(0, 0, 100, 100);
  row.getBoundingClientRect = () => new window.DOMRect(0, rowTop, 100, 100);
  element.scrollTop = 80;
  const held = holdHistoryPosition(element as unknown as HTMLDivElement);
  rowTop += 480;
  held.restore(true);
  expect(element.scrollTop).toBe(560);
  expect(element.style.overflowY).toBe("");
});
