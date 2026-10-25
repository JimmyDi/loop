import { expect, test } from "vitest";
import { Window } from "happy-dom";

test("closed mobile drawer is inert to keyboard navigation", async () => {
  const window = new Window({ width: 390 });
  const media = Object.assign(new window.EventTarget(), { matches: true });
  window.matchMedia = () => media as unknown as ReturnType<typeof window.matchMedia>;
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, cleanup } = await import("@testing-library/react/pure");
    const { useMobileDrawer } = await import("./useMobileDrawer");
    const element = window.document.createElement("div");
    const ref = { current: element as unknown as HTMLElement };

    renderHook(() => useMobileDrawer(ref, false, () => {}));
    expect(element.inert).toBe(true);
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("open drawer contains focus and makes background inert only on mobile", async () => {
  const window = new Window({ width: 390 });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup } = await import("@testing-library/react/pure");
  try {
    const { useMobileDrawer } = await import("./useMobileDrawer");
    const media = Object.assign(new window.EventTarget(), { matches: true });
    window.matchMedia = () => media as unknown as ReturnType<typeof window.matchMedia>;
    const background = window.document.createElement("main");
    const trigger = window.document.createElement("button");
    background.append(trigger);
    const drawer = window.document.createElement("div");
    drawer.innerHTML = "<button>Close</button><button>Last</button>";
    window.document.body.append(background, drawer);
    trigger.focus();
    const ref = { current: drawer as unknown as HTMLElement };
    const content = { current: background as unknown as HTMLElement };
    let closed = false;
    renderHook(() =>
      useMobileDrawer(
        ref,
        true,
        () => {
          closed = true;
        },
        content,
      ),
    );
    expect(background.inert).toBe(true);
    expect(window.document.activeElement).toBe(drawer.firstElementChild);
    (drawer.lastElementChild as unknown as HTMLElement).focus();
    drawer.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    expect(window.document.activeElement).toBe(drawer.firstElementChild);
    drawer.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closed).toBe(true);
    media.matches = false;
    media.dispatchEvent(new window.Event("change"));
    expect(background.inert).toBe(false);
    cleanup();
    expect(drawer.inert).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("portrait phones and compact unfolded touch screens use the same breakpoint as drawer focus", async () => {
  const window = new Window({ width: 980, height: 1600 });
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup } = await import("@testing-library/react/pure");
  try {
    const { useMobileDrawer } = await import("./useMobileDrawer");
    const media = Object.assign(new window.EventTarget(), { matches: true });
    let suppliedQuery = "";
    window.matchMedia = (query) => {
      suppliedQuery = query;
      return media as unknown as ReturnType<typeof window.matchMedia>;
    };
    const drawer = window.document.createElement("aside");
    const background = window.document.createElement("main");
    const ref = { current: drawer as unknown as HTMLElement };
    const content = { current: background as unknown as HTMLElement };
    renderHook(() => useMobileDrawer(ref, false, () => {}, content));
    expect(suppliedQuery).toBe("(max-width: 767px), (pointer: coarse) and (max-width: 1024px)");
    expect(drawer.inert).toBe(true);
    // Folding/unfolding within the mobile range retains drawer isolation.
    media.dispatchEvent(new window.Event("change"));
    expect(drawer.inert).toBe(true);
    // Moving to a desktop-size viewport releases it without a reload.
    media.matches = false;
    media.dispatchEvent(new window.Event("change"));
    expect(drawer.inert).toBe(false);
    expect(background.inert).toBe(false);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
