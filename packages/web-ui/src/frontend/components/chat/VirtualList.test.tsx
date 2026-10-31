import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { VirtualList } from "./VirtualList";
import { ToolCard } from "./ToolCard";
import { TimelineDisclosures } from "../../lib/timeline-disclosures";
import "../../i18n/setup";

test("thousands of rows mount only a window and restore tool disclosures after scrolling", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act, fireEvent } = await import("@testing-library/react/pure");
  const element = window.document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 600 });
  let top = 0;
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value) => {
      top = value;
    },
  });
  const rect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const bounds = rect.call(this);
    if (this.classList.contains("virtual-list")) bounds.y = -top;
    return bounds;
  };
  const viewport = { current: element as unknown as HTMLDivElement };
  const saved = new Map<string, boolean>();
  const rows = Array.from({ length: 10000 }, (_, index) => ({
    key: String(index),
    render: () => (
      <ToolCard
        tool={{ id: String(index), name: "read", status: "success", args: { path: "example.ts" } }}
      />
    ),
  }));
  try {
    const ui = render(
      <TimelineDisclosures value={saved}>
        <VirtualList rows={rows} viewport={viewport} />
      </TimelineDisclosures>,
    );
    expect(ui.container.querySelectorAll(".virtual-row").length).toBeLessThan(20);
    expect(ui.container.querySelectorAll(".virtual-spacer").length).toBeLessThan(4);
    const card = ui.container.querySelector<HTMLDetailsElement>("details")!;
    const key = card.closest<HTMLElement>(".virtual-row")!.dataset.rowKey!;
    act(() => {
      card.open = true;
      fireEvent(card, new window.Event("toggle", { bubbles: true }) as unknown as Event);
    });
    act(() => {
      top = 800000;
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(ui.container.querySelector('[data-row-key="' + key + '"]')).toBeNull();
    expect(ui.container.querySelectorAll(".virtual-row").length).toBeLessThan(20);
    act(() => {
      top = 0;
      element.dispatchEvent(new window.Event("scroll"));
    });
    expect(
      ui.container.querySelector<HTMLDetailsElement>('[data-row-key="' + key + '"] details')!.open,
    ).toBe(true);
    const prefix = [{ key: "older", render: () => <p>Older history</p> }];
    ui.rerender(
      <TimelineDisclosures value={saved}>
        <VirtualList rows={[...prefix, ...rows]} viewport={viewport} />
      </TimelineDisclosures>,
    );
    expect(ui.container.querySelectorAll(".virtual-row").length).toBeLessThan(20);
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = rect;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("opening a long reply measures rows before paint and survives a programmatic bottom jump", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const element = window.document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: 600 });
  let top = 0;
  Object.defineProperty(element, "scrollTop", {
    get: () => top,
    set: (value) => {
      top = value;
    },
  });
  const original = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const rect = original.call(this);
    if (this.classList.contains("virtual-list")) rect.y = -top;
    if (this.classList.contains("virtual-row")) {
      rect.height = this.dataset.rowKey === "reply" ? 8000 : 100;
      rect.y = -top;
    }
    return rect;
  };
  const rows = [
    { key: "user", render: () => <p>Question</p> },
    { key: "reply", render: () => <article>Long reply</article> },
  ];
  try {
    const ui = render(
      <VirtualList rows={rows} viewport={{ current: element as unknown as HTMLDivElement }} />,
    );
    // No ResizeObserver callback or browser scroll event precedes this jump.
    act(() => {
      top = 7500;
    });
    ui.rerender(
      <VirtualList rows={[...rows]} viewport={{ current: element as unknown as HTMLDivElement }} />,
    );
    expect(ui.container.querySelector('[data-row-key="reply"]')).not.toBeNull();
    expect(ui.container.textContent).toContain("Long reply");
    act(() => {
      top = 20000;
    });
    ui.rerender(
      <VirtualList rows={[...rows]} viewport={{ current: element as unknown as HTMLDivElement }} />,
    );
    expect(ui.container.querySelector('[data-row-key="reply"]')).not.toBeNull();
  } finally {
    cleanup();
    window.HTMLElement.prototype.getBoundingClientRect = original;
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
