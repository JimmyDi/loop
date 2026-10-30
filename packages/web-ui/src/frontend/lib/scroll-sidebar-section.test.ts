import { Window } from "happy-dom";
import { expect, test } from "vitest";

import {
  isSidebarSectionAtTop,
  preserveSidebarScroll,
  scrollSidebarSection,
} from "./scroll-sidebar-section";

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

test.each([32, 44])(
  "section navigation includes heading gaps at %spx row height",
  async (height) => {
    const window = new Window();
    try {
      const scroll = window.document.createElement("div");
      scroll.className = "sidebar-scroll";
      scroll.innerHTML =
        '<section class="pinned-sessions"><h2>Pinned</h2><div class="pin"></div></section><section class="standalone-chats"><h2>Chats</h2><div class="chat"></div></section><div class="sidebar-heading">Projects</div><div class="project-item"></div>';
      window.document.body.append(scroll);
      scroll.getBoundingClientRect = () => new window.DOMRect(0, 100, 260, 400);
      const headings = scroll.querySelectorAll("h2, .sidebar-heading");
      for (const [index, heading] of headings.entries()) {
        heading.setAttribute("style", "margin-top: 4px");
        heading.getBoundingClientRect = () =>
          new window.DOMRect(0, 104 + index * (height + 4), 260, height);
        const target = heading.nextElementSibling!;
        const selector = "." + target.className;
        const alignedTop = 100 + (index + 1) * (height + 4);
        for (const offset of [-60, 0, 60]) {
          target.getBoundingClientRect = () =>
            new window.DOMRect(0, alignedTop + offset, 260, height);
          expect(isSidebarSectionAtTop(heading as unknown as HTMLElement, selector)).toBe(
            offset === 0,
          );
        }
        target.getBoundingClientRect = () => new window.DOMRect(0, 400, 260, height);
        scroll.scrollTop = 500;
        let updates = 0;
        scroll.addEventListener("scroll", () => updates++, { once: true });
        scrollSidebarSection(heading as unknown as HTMLElement, "." + target.className);
        expect(scroll.scrollTop).toBe(800 - (index + 1) * (height + 4));
        expect(updates).toBe(1);
      }
    } finally {
      await window.happyDOM.close();
    }
  },
);

test.each(["pin", "chat", "project-item"])(
  "%s collapses when its first row is directly below a heading that has not stuck",
  async (kind) => {
    const window = new Window();
    try {
      const scroll = window.document.createElement("div");
      scroll.className = "sidebar-scroll";
      scroll.innerHTML = '<div class="sidebar-heading"></div><div></div>';
      window.document.body.append(scroll);
      const heading = scroll.firstElementChild!;
      const first = scroll.lastElementChild!;
      first.className = kind;
      const gap = kind === "project-item" ? 2 : 0;
      first.setAttribute("style", "margin-top: " + gap + "px");
      scroll.getBoundingClientRect = () => new window.DOMRect(0, 100, 260, 600);
      heading.getBoundingClientRect = () => new window.DOMRect(0, 350, 260, 32);
      for (const offset of [0, -80, 80]) {
        first.getBoundingClientRect = () => new window.DOMRect(0, 382 + gap + offset, 260, 32);
        expect(isSidebarSectionAtTop(heading as unknown as HTMLElement, "." + kind)).toBe(
          offset === 0,
        );
      }
    } finally {
      await window.happyDOM.close();
    }
  },
);

test("collapsing a list reserves enough space to preserve the stacked scroll position", async () => {
  const window = new Window();
  try {
    const scroll = window.document.createElement("div");
    scroll.className = "sidebar-scroll";
    const heading = window.document.createElement("div");
    scroll.append(heading);
    let contentHeight = 1200;
    Object.defineProperty(scroll, "clientHeight", { value: 500 });
    Object.defineProperty(scroll, "scrollHeight", {
      get: () => contentHeight + (Number.parseFloat(scroll.style.paddingBottom) || 0),
    });
    scroll.scrollTop = 300;
    preserveSidebarScroll(heading as unknown as HTMLElement, () => {
      contentHeight = 400;
      expect(scroll.scrollHeight).toBeGreaterThanOrEqual(800);
    });
    expect(scroll.scrollTop).toBe(300);
    expect(scroll.style.paddingBottom).toBe("400px");
    preserveSidebarScroll(heading as unknown as HTMLElement, () => {
      contentHeight = 1200;
    });
    expect(scroll.style.paddingBottom).toBe("0px");
  } finally {
    await window.happyDOM.close();
  }
});
