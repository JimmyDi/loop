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
    element.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
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
