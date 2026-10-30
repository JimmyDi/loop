import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test } from "vitest";

import type { SessionSummary } from "../../../shared/protocol";
import "../../i18n/setup";
import { SidebarSessionSection } from "./SidebarSessionSection";

test.each(["chats", "pinned"] as const)("%s shares paging and folding", async (kind) => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient();
  const sessions: SessionSummary[] = Array.from({ length: 17 }, (_, index) => ({
    id: "chat-" + index,
    workspaceId: null,
    title: "Chat " + index,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messageCount: 2,
    userMessageCount: 1,
    pinnedAt: kind === "pinned" ? "2026-01-01T00:00:00Z" : undefined,
  }));
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <div className="sidebar-scroll">
          <SidebarSessionSection title="Section" kind={kind} sessions={sessions} />
        </div>
      </QueryClientProvider>,
    );
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(5);
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(15);
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(17);
    expect(ui.queryByRole("button", { name: "Show more" })).toBeNull();
    const scroll = ui.container.querySelector<HTMLElement>(".sidebar-scroll")!;
    const heading = ui.container.querySelector<HTMLElement>("h2")!;
    const first = ui.container.querySelector<HTMLElement>(".session-item")!;
    heading.style.marginTop = "4px";
    scroll.getBoundingClientRect = () => new window.DOMRect(0, 100, 260, 400);
    heading.getBoundingClientRect = () => new window.DOMRect(0, 104, 260, 32);
    first.getBoundingClientRect = () => new window.DOMRect(0, 212 - scroll.scrollTop, 260, 32);
    fireEvent.click(ui.getByRole("button", { name: "Section" }));
    expect(scroll.scrollTop).toBe(76);
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(17);
    scroll.scrollTop = 120;
    fireEvent.click(ui.getByRole("button", { name: /Expand or collapse/ }));
    expect(scroll.scrollTop).toBe(76);
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(17);
    fireEvent.click(ui.getByRole("button", { name: /Expand or collapse/ }));
    expect(ui.queryByRole("button", { name: "Chat 0" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Section" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(17);
    heading.getBoundingClientRect = () => new window.DOMRect(0, 300, 260, 32);
    first.getBoundingClientRect = () => new window.DOMRect(0, 332, 260, 32);
    const position = scroll.scrollTop;
    fireEvent.click(ui.getByRole("button", { name: "Section" }));
    expect(ui.queryByRole("button", { name: "Chat 0" })).toBeNull();
    expect(scroll.scrollTop).toBe(position);
    for (const name of ["Section", /Expand or collapse/]) {
      let scrollEvents = 0;
      const onScroll = () => scrollEvents++;
      scroll.addEventListener("scroll", onScroll);
      fireEvent.click(ui.getByRole("button", { name }));
      expect(ui.getByRole("button", { name: "Chat 0" })).toBeTruthy();
      expect(scroll.scrollTop).toBe(position);
      expect(scrollEvents).toBe(0);
      scroll.removeEventListener("scroll", onScroll);
      fireEvent.click(ui.getByRole("button", { name }));
      expect(ui.queryByRole("button", { name: "Chat 0" })).toBeNull();
    }
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
