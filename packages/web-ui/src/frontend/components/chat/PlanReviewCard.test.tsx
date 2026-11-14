import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { PlanReviewCard } from "./PlanReviewCard";
import type { SessionSnapshot } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";

const mocks = vi.hoisted(() => ({ command: vi.fn(), submitText: vi.fn(), resync: vi.fn() }));
vi.mock("../../lib/api", async (original) => ({
  ...(await original<typeof import("../../lib/api")>()),
  command: mocks.command,
}));
vi.mock("../../hooks/usePrompt", () => ({
  usePrompt: () => ({ submitText: mocks.submitText, pending: false, uncertain: false }),
}));
vi.mock("../../state/session-store", () => ({
  useSessions: { getState: () => ({ resync: mocks.resync }) },
}));

test("review requires explicit implementation, supports feedback and skips without execution", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const snapshot = {
    sessionId: "s",
    operation: "idle",
    state: {
      isRunning: false,
      planning: {
        mode: "plan",
        plans: [{ id: "p", version: 2, title: "Plan", markdown: "Steps", status: "ready" }],
      },
    },
  } as SessionSnapshot;
  try {
    await i18n.changeLanguage("en");
    mocks.command.mockReset().mockResolvedValue(undefined);
    mocks.submitText.mockReset().mockResolvedValue("accepted");
    const view = render(<PlanReviewCard snapshot={snapshot} connected />);
    expect(mocks.command).not.toHaveBeenCalled();
    expect(view.queryByRole("button", { name: "Send" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(view.queryByRole("form")).toBeNull());
    expect(mocks.command).toHaveBeenCalledWith("/sessions/s/skip-plan", { id: "p", version: 2 });
    mocks.command.mockClear();
    view.rerender(<PlanReviewCard key="new" snapshot={snapshot} connected />);
    const input = view.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.submitText).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Use the existing interface" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mocks.submitText).not.toHaveBeenCalled();
    mocks.submitText.mockResolvedValueOnce("rejected");
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(mocks.submitText).toHaveBeenCalledOnce());
    expect(view.getByRole("textbox")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(view.queryByRole("form")).toBeNull());
    expect(mocks.submitText).toHaveBeenLastCalledWith("Use the existing interface");
    expect(mocks.command).not.toHaveBeenCalled();
    view.rerender(<PlanReviewCard key="execute" snapshot={snapshot} connected />);
    fireEvent.click(view.getByRole("button", { name: "Yes, implement this plan" }));
    await waitFor(() => expect(view.queryByRole("form")).toBeNull());
    expect(mocks.command).toHaveBeenCalledExactlyOnceWith("/sessions/s/execute-plan", {
      id: "p",
      version: 2,
    });
    view.rerender(<PlanReviewCard key="blocked" snapshot={snapshot} connected={false} />);
    expect((view.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Yes, implement this plan" }));
    expect(mocks.command).toHaveBeenCalledOnce();
    view.rerender(
      <PlanReviewCard key="running" snapshot={{ ...snapshot, operation: "prompt" }} connected />,
    );
    expect((view.getByRole("button", { name: "Skip" }) as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<PlanReviewCard key="close" snapshot={snapshot} connected />);
    fireEvent.click(view.getByRole("button", { name: "Skip plan review" }));
    await waitFor(() => expect(view.queryByRole("form")).toBeNull());
    expect(mocks.command).toHaveBeenLastCalledWith("/sessions/s/skip-plan", {
      id: "p",
      version: 2,
    });
    view.rerender(
      <PlanReviewCard
        key="reopened"
        snapshot={{
          ...snapshot,
          state: {
            ...snapshot.state,
            planning: {
              mode: "execute",
              plans: [{ ...snapshot.state.planning!.plans[0]!, status: "skipped" }],
            },
          },
        }}
        connected
      />,
    );
    expect(view.queryByRole("form")).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
