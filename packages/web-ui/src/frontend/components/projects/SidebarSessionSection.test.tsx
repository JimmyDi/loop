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
        <SidebarSessionSection title="Section" kind={kind} sessions={sessions} />
      </QueryClientProvider>,
    );
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(5);
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(15);
    fireEvent.click(ui.getByRole("button", { name: "Show more" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(17);
    expect(ui.queryByRole("button", { name: "Show more" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: /Expand or collapse/ }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(0);
    fireEvent.click(ui.getByRole("button", { name: "Section" }));
    expect(ui.container.querySelectorAll(".session-item")).toHaveLength(5);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
