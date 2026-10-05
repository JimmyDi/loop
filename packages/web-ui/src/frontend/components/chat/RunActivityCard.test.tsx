import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { Message, ToolView } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { RunActivityCard } from "./RunActivityCard";

test("one section owns ordered updates, nested disclosures and persistent expansion", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const message = {
    role: "assistant",
    content: [
      { type: "text", text: "Read the configuration" },
      { type: "toolCall", id: "one", name: "read", arguments: { path: "config.ts" } },
    ],
  } as Extract<Message, { role: "assistant" }>;
  const entries = [{ index: 1, message }];
  const tools: Record<string, ToolView> = { one: { id: "one", name: "read", status: "running" } };

  try {
    const ui = render(
      <RunActivityCard
        entries={entries}
        tools={tools}
        status="running"
        title="Check the project"
      />,
    );
    const root = ui.container.querySelector<HTMLDetailsElement>(".run-activity-disclosure")!;
    const group = ui.container.querySelector<HTMLDetailsElement>(".execution-group > details")!;
    expect(root.open).toBe(true);
    expect(group.open).toBe(true);
    expect(ui.container.querySelector(".assistant-avatar")).toBeNull();
    expect(ui.container.querySelector(".copy-button")).toBeNull();
    expect(ui.container.querySelector<HTMLDetailsElement>(".tool-card")?.open).toBe(false);
    await act(async () => {
      root.open = false;
      fireEvent(root, new window.Event("toggle") as unknown as Event);
    });
    const nextMessage = {
      ...message,
      content: [
        { type: "text" as const, text: "Check another file" },
        { type: "toolCall" as const, id: "two", name: "read", arguments: {} },
      ],
    };
    const nextEntries = [...entries, { index: 3, message: nextMessage }];
    const nextTools: Record<string, ToolView> = {
      one: { ...tools.one!, status: "error" },
      two: { id: "two", name: "read", status: "success" },
    };
    ui.rerender(
      <RunActivityCard
        entries={nextEntries}
        tools={nextTools}
        status="success"
        title="Check the project"
      />,
    );
    expect(ui.container.querySelector(".run-activity-disclosure")).toBe(root);
    expect(root.open).toBe(false);
    expect(group.open).toBe(true);
    expect(root.querySelector("summary")?.textContent).toContain("Work completed");
    expect(root.querySelector("summary")?.textContent).toContain("1 failed");
    expect(ui.container.querySelectorAll(".run-activity-card")).toHaveLength(1);
    expect(ui.container.querySelectorAll(".activity-step")).toHaveLength(2);
    expect(ui.container.textContent!.indexOf("Read the configuration")).toBeLessThan(
      ui.container.textContent!.indexOf("Check another file"),
    );
    await act(() => i18n.changeLanguage("zh"));
    expect(root.querySelector("summary")?.textContent).toContain("执行完成");
    ui.unmount();
    const history = render(
      <RunActivityCard
        entries={nextEntries}
        tools={nextTools}
        status="cancelled"
        title="Check the project"
      />,
    );
    expect(
      history.container.querySelector<HTMLDetailsElement>(".run-activity-disclosure")?.open,
    ).toBe(false);
    expect(
      history.container.querySelector<HTMLDetailsElement>(".execution-group > details")?.open,
    ).toBe(true);
    expect(history.container.textContent).toContain("执行已取消");
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
