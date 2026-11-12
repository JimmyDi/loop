import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../../shared/protocol";
import { MessageNavigation } from "./MessageNavigation";
import "../../i18n/setup";

test("previews open on hover/focus, jump, save bookmarks and restore them after remount", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const bookmarks: number[] = [];
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ messageIndex: 0, streamId: "stream" });
      bookmarks.splice(0, bookmarks.length, ...(body.bookmarked ? [0] : []));
      return Response.json({ bookmarks });
    }
    return Response.json({
      previews: [{ index: 0, user: "Request", reply: "Response" }],
      bookmarks,
    });
  });
  const snapshot: SessionSnapshot = {
    sessionId: "test",
    streamId: "stream",
    workspaceId: null,
    model: { id: "test", name: "Test", provider: "test" },
    operation: "idle",
    tools: {},
    state: {
      messages: [{ role: "user", content: "Request", timestamp: 0 }],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const select = vi.fn();
  const view = (
    <MessageNavigation snapshot={snapshot} viewport={{ current: null }} onSelect={select} />
  );
  try {
    const ui = render(view);
    await act(async () => {});
    expect(ui.container.querySelector(".message-navigation-preview")).toBeNull();
    const mark = ui.getByRole("button", { name: "Turn 1: Request" });
    fireEvent.mouseEnter(mark);
    expect(ui.container.querySelector(".message-navigation-reply")?.textContent?.trim()).toBe(
      "No reply yet",
    );
    fireEvent.click(mark);
    expect(select).toHaveBeenCalledWith(0);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Bookmark turn" })));
    expect(ui.getByRole("button", { name: "Remove bookmark" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const dot = ui.container.querySelector(".message-navigation-dot")!;
    expect(dot.parentElement?.className).toBe("message-navigation-line");
    fireEvent.mouseLeave(ui.getByRole("navigation"));
    fireEvent.scroll(ui.container.querySelector(".message-navigation-marks")!);
    expect(ui.container.querySelector('[data-expanded="true"]')).toBeNull();
    expect(mark.getAttribute("data-wave-distance")).toBe("4");
    expect(dot.parentElement?.className).toBe("message-navigation-line");
    ui.unmount();
    const restored = render(view);
    await act(async () => {});
    fireEvent.focus(restored.getByRole("button", { name: "Turn 1: Request" }));
    expect(restored.getByRole("button", { name: "Remove bookmark" })).toBeDefined();
    await act(async () =>
      fireEvent.click(restored.getByRole("button", { name: "Remove bookmark" })),
    );
    expect(restored.container.querySelector(".message-navigation-dot")).toBeNull();
    fetcher.mockRejectedValueOnce(new Error("disk unavailable"));
    await act(async () => fireEvent.click(restored.getByRole("button", { name: "Bookmark turn" })));
    expect(restored.getByRole("alert").textContent).toContain("could not be saved");
    expect(restored.container.querySelector(".message-navigation-dot")).toBeNull();
    fireEvent.keyDown(restored.getByRole("navigation"), { key: "Escape" });
    expect(restored.container.querySelector(".message-navigation-preview")).toBeNull();
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("scrolling highlights the top turn and its neighbours using absolute assistant indexes", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const previews = [0, 10, 20, 30, 40].map((index) => ({
    index,
    user: "Request " + index,
    reply: "",
  }));
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ previews, bookmarks: [] }));
  const viewport = window.document.createElement("div");
  window.document.body.append(viewport);
  viewport.style.paddingTop = "20px";
  viewport.innerHTML =
    '<div class="timeline-content"><div class="virtual-list"><div class="virtual-row" data-row-key="test:10:25"><div class="virtual-list"><div class="virtual-row" data-row-key="0"></div></div></div><div class="virtual-row" data-row-key="test:30"></div></div></div>';
  let firstBottom = 100;
  const rows = viewport.querySelectorAll(".timeline-content > .virtual-list > .virtual-row");
  rows[0]!.getBoundingClientRect = () => new window.DOMRect(0, -100, 100, firstBottom + 100);
  rows[1]!.getBoundingClientRect = () => new window.DOMRect(0, firstBottom, 100, 100);
  const snapshot = {
    sessionId: "test",
    streamId: "stream",
    state: { messages: [] },
    tools: {},
    operation: "idle",
  } as unknown as SessionSnapshot;
  try {
    const ui = render(
      <MessageNavigation
        snapshot={snapshot}
        viewport={{ current: viewport as unknown as HTMLDivElement }}
        onSelect={() => {}}
      />,
    );
    await act(async () => {});
    const highlighted = () =>
      Array.from(ui.container.querySelectorAll('[data-near-active="true"]')).map((mark) =>
        mark.getAttribute("aria-label"),
      );
    expect(highlighted()).toEqual(["Turn 5: Request 40"]);
    expect(
      ui.container.querySelector('[aria-current="location"]')?.getAttribute("aria-label"),
    ).toBe("Turn 5: Request 40");
    fireEvent.scroll(viewport as unknown as HTMLDivElement);
    expect(highlighted()).toEqual([
      "Turn 2: Request 10",
      "Turn 3: Request 20",
      "Turn 4: Request 30",
    ]);
    expect(
      ui.container.querySelector('[aria-current="location"]')?.getAttribute("aria-label"),
    ).toBe("Turn 3: Request 20");
    firstBottom = 20;
    fireEvent.scroll(viewport as unknown as HTMLDivElement);
    expect(highlighted()).toEqual([
      "Turn 3: Request 20",
      "Turn 4: Request 30",
      "Turn 5: Request 40",
    ]);
    expect(ui.container.querySelector(".message-navigation-preview")).toBeNull();
    const wave = () =>
      Array.from(ui.container.querySelectorAll(".message-navigation-mark")).map((mark) =>
        mark.getAttribute("data-wave-distance"),
      );
    fireEvent.mouseEnter(ui.getByRole("button", { name: "Turn 3: Request 20" }));
    expect(wave()).toEqual(["2", "1", "0", "1", "2"]);
    fireEvent.mouseEnter(ui.getByRole("button", { name: "Turn 4: Request 30" }));
    expect(wave()).toEqual(["3", "2", "1", "0", "1"]);
    fireEvent.mouseLeave(ui.getByRole("navigation"));
    expect(wave()).toEqual(["4", "4", "4", "4", "4"]);
    await act(async () => {
      rows[0]!.setAttribute("data-row-key", "test:0");
      firstBottom = 100;
      rows[1]!.remove();
    });
    expect(highlighted()).toEqual(["Turn 1: Request 0", "Turn 2: Request 10"]);
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("long session initialization retains every fixed-spacing navigation target", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  const previews = Array.from({ length: 100 }, (_, index) => ({
    index,
    user: "Request " + index,
    reply: "",
  }));
  let resolve: ((response: Response) => void) | undefined;
  const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const snapshot = {
    sessionId: "test",
    streamId: "stream",
    state: { messages: [{ role: "user", content: "Request 99", timestamp: 99 }] },
    tools: {},
    operation: "idle",
    history: { start: 99, total: 100, userStart: 99 },
  } as unknown as SessionSnapshot;
  try {
    const ui = render(
      <MessageNavigation snapshot={snapshot} viewport={{ current: null }} onSelect={() => {}} />,
    );
    const marks = ui.container.querySelector<HTMLDivElement>(".message-navigation-marks")!;
    await act(async () => resolve!(Response.json({ previews, bookmarks: [] })));
    expect(marks.querySelectorAll(".message-navigation-mark")).toHaveLength(100);
    expect(marks.scrollTop).toBe(0);
    expect(
      ui.container
        .querySelector<HTMLElement>(".message-navigation")!
        .style.getPropertyValue("--navigation-count"),
    ).toBe("100");
    const last = marks.querySelector<HTMLElement>('[data-active="true"]')!;
    expect(last.getAttribute("aria-label")).toBe("Turn 100: Request 99");
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("preview renders Markdown safely with a separate jump button and bookmark control", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      previews: [
        {
          index: 0,
          user: "**Question**",
          reply:
            "# Answer\n\n**Result** with \u0060code\u0060 and [link](https://example.com)\n\n<img src=x onerror=alert(1)>",
        },
      ],
      bookmarks: [],
    }),
  );
  const snapshot = {
    sessionId: "test",
    streamId: "stream",
    state: { messages: [] },
    tools: {},
    operation: "idle",
  } as unknown as SessionSnapshot;
  const select = vi.fn();
  try {
    const ui = render(
      <MessageNavigation snapshot={snapshot} viewport={{ current: null }} onSelect={select} />,
    );
    await act(async () => {});
    fireEvent.mouseEnter(ui.container.querySelector(".message-navigation-mark")!);
    const preview = ui.container.querySelector(".message-navigation-preview")!;
    expect(preview.querySelector(".message-navigation-user strong")?.textContent).toBe("Question");
    expect(preview.querySelector(".message-navigation-reply")?.textContent).toContain("Answer");
    expect(preview.querySelector(".message-navigation-reply")?.textContent).not.toContain(
      "# Answer",
    );
    expect(preview.querySelector(".message-navigation-reply strong")?.textContent).toBe("Result");
    expect(preview.querySelector("code")?.textContent).toBe("code");
    expect(preview.querySelector("[onerror]")).toBeNull();
    expect(preview.querySelector("button button, button a")).toBeNull();
    expect(preview.querySelector(".message-navigation-summary")?.hasAttribute("inert")).toBe(true);
    const mark = ui.container.querySelector(".message-navigation-mark")!;
    fireEvent.mouseOut(mark, { relatedTarget: preview });
    fireEvent.mouseOver(preview, { relatedTarget: mark });
    expect(ui.container.querySelector(".message-navigation-preview")).toBe(preview);
    fireEvent.click(preview.querySelector(".message-navigation-jump")!);
    expect(select).toHaveBeenCalledWith(0);
    expect(ui.getByRole("button", { name: "Bookmark turn" })).toBeDefined();
  } finally {
    cleanup();
    fetcher.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
