import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { scrollSidebarSection } from "./scroll-sidebar-section";

test.each([true, false])("navigation clears sticky headings; pins=%s", async (hasPins) => {
  const window = new Window();
  try {
    const scroll = window.document.createElement("div");
    scroll.className = "sidebar-scroll";
    scroll.innerHTML =
      '<section class="pinned-sessions"><h2>Pinned</h2></section><div class="sidebar-heading">Projects</div><div class="project-item"></div>';
    const pinned = scroll.querySelector("h2")!;
    const heading = scroll.querySelector(".sidebar-heading")!;
    const first = scroll.querySelector(".project-item")!;
    scroll.scrollTop = 500;
    scroll.getBoundingClientRect = () => new window.DOMRect(0, 100, 260, 400);
    pinned.getBoundingClientRect = () => new window.DOMRect(0, 100, 260, 32);
    heading.getBoundingClientRect = () => new window.DOMRect(0, 132, 260, 32);
    first.getBoundingClientRect = () => new window.DOMRect(0, 200, 260, 32);
    if (!hasPins) pinned.parentElement!.remove();
    scrollSidebarSection(heading as unknown as HTMLElement, ".project-item");
    expect(scroll.scrollTop).toBe(hasPins ? 536 : 568);
    if (hasPins) {
      scroll.scrollTop = 500;
      scrollSidebarSection(pinned as unknown as HTMLElement, ".project-item");
      expect(scroll.scrollTop).toBe(568);
    }
    first.remove();
    const position = scroll.scrollTop;
    scrollSidebarSection(heading as unknown as HTMLElement, ".project-item");
    expect(scroll.scrollTop).toBe(position);
  } finally {
    await window.happyDOM.close();
  }
});
