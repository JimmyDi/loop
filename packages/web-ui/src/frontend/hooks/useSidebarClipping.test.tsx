import { Window } from "happy-dom";
import { expect, test } from "vitest";

import { useSidebarClipping } from "./useSidebarClipping";

test("sidebar lists are clipped below their headings and revealed on reverse scroll", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, act, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const scroll = document.createElement("div");
  scroll.innerHTML =
    '<section class="pinned-sessions"><h2>Pinned</h2><ul class="session-list"></ul></section><div class="sidebar-heading">Projects</div><div class="sidebar-projects"></div>';
  document.body.append(scroll);
  let pinnedTop = 100;
  let projectsTop = 300;
  const pin = scroll.querySelector<HTMLElement>("h2")!;
  const heading = scroll.querySelector<HTMLElement>(".sidebar-heading")!;
  const pins = scroll.querySelector<HTMLElement>("ul")!;
  const projects = scroll.querySelector<HTMLElement>(".sidebar-projects")!;
  pin.getBoundingClientRect = () => ({ bottom: 100 }) as DOMRect;
  heading.getBoundingClientRect = () => ({ bottom: 132 }) as DOMRect;
  pins.getBoundingClientRect = () => ({ top: pinnedTop, height: 200 }) as DOMRect;
  projects.getBoundingClientRect = () => ({ top: projectsTop, height: 500 }) as DOMRect;
  try {
    const ui = renderHook(() => {
      const ref = useSidebarClipping();
      ref.current = scroll;
      return ref;
    });
    expect(pins.style.getPropertyValue("--sidebar-list-clip")).toBe("0px");
    expect(projects.style.getPropertyValue("--sidebar-list-clip")).toBe("0px");
    act(() => {
      pinnedTop = 60;
      projectsTop = 90;
      fireEvent.scroll(scroll);
    });
    expect(pins.style.getPropertyValue("--sidebar-list-clip")).toBe("40px");
    expect(projects.style.getPropertyValue("--sidebar-list-clip")).toBe("42px");
    act(() => {
      pinnedTop = -500;
      fireEvent.scroll(scroll);
    });
    expect(pins.style.getPropertyValue("--sidebar-list-clip")).toBe("200px");
    act(() => {
      pinnedTop = 100;
      projectsTop = 300;
      fireEvent.scroll(scroll);
    });
    expect(pins.style.getPropertyValue("--sidebar-list-clip")).toBe("0px");
    expect(projects.style.getPropertyValue("--sidebar-list-clip")).toBe("0px");
    ui.unmount();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
