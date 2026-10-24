import { expect, test } from "vitest";
import { Window } from "happy-dom";

test("closed mobile drawer is inert to keyboard navigation", async () => {
  const window = new Window({ width: 390 });
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
