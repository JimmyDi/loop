import { expect, test } from "vitest";
import { Window } from "happy-dom";

import { UserInputCard } from "./UserInputCard";
import type { UserInputRequest } from "../../../shared/protocol";
import "../../i18n/setup";
import { useSessions } from "../../state/session-store";

test("questions require explicit submission, free text clears choices, and failed answers retain edits", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const sessions = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const request: UserInputRequest = {
    sessionId: "session",
    requestId: "request",
    createdAt: 0,
    questions: [
      {
        id: "q",
        text: "Which strategy?",
        options: [
          { id: "a", label: "Automatic" },
          { id: "m", label: "Manual" },
        ],
        recommendedOptionId: "a",
      },
    ],
  };
  const calls: unknown[] = [];
  let finish!: (response: Response) => void;
  globalThis.fetch = (async (_url, options) => {
    calls.push(JSON.parse(String(options?.body)));
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  try {
    const ui = render(<UserInputCard request={request} connected={false} />);
    expect(ui.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    ui.rerender(<UserInputCard request={request} connected />);
    expect(calls).toEqual([]);
    expect(ui.getByRole("status").textContent).toBe("Question");
    expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    expect(ui.container.querySelectorAll(".user-input-number")).toHaveLength(2);
    expect((ui.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(true);
    expect(ui.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(ui.getByLabelText("Manual"));
    fireEvent.change(ui.getByRole("textbox"), { target: { value: "Custom strategy" } });
    expect((ui.getByLabelText("Manual") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(ui.getByRole("button", { name: "Send" }));
    fireEvent.submit(ui.container.querySelector("form")!);
    expect(calls).toEqual([
      { answers: [{ questionId: "q", type: "text", text: "Custom strategy" }] },
    ]);
    await act(async () =>
      finish(
        Response.json(
          { code: "user_input_not_pending", message: "Question ended" },
          { status: 409 },
        ),
      ),
    );
    expect((ui.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Custom strategy");
    expect(ui.getByRole("alert")).toBeTruthy();
    expect(useSessions.getState().views.session?.connected).toBe(false);
  } finally {
    cleanup();
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("Skip records explicit skips, blank Send is disabled and header navigation retains edits", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const sessions = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const calls: unknown[] = [];
  globalThis.fetch = (async (_url, options) => {
    calls.push(JSON.parse(String(options?.body)));
    return Response.json({});
  }) as typeof fetch;
  const request: UserInputRequest = {
    sessionId: "session",
    requestId: "skip-test",
    createdAt: 0,
    questions: [
      { id: "first", text: "Name?" },
      { id: "last", text: "Notes?" },
    ],
  };
  try {
    const ui = render(<UserInputCard request={request} connected />);
    expect(ui.container.querySelector("legend")?.textContent).toBe("Name?");
    expect(ui.getByText("1 of 2")).toBeTruthy();
    expect(ui.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(ui.getByRole("button", { name: "Next question" }));
    fireEvent.change(ui.getByRole("textbox"), { target: { value: " " } });
    expect(ui.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(ui.container.querySelector("form")!);
    expect(calls).toEqual([]);
    fireEvent.click(ui.getByRole("button", { name: "Skip" }));
    expect(ui.getByLabelText("Name?")).toBeTruthy();
    expect(calls).toEqual([]);
    fireEvent.change(ui.getByRole("textbox"), { target: { value: "Example" } });
    fireEvent.click(ui.getByRole("button", { name: "Next" }));
    fireEvent.click(ui.getByRole("button", { name: "Previous" }));
    expect((ui.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Example");
    fireEvent.click(ui.getByRole("button", { name: "Skip" }));
    expect(calls).toEqual([]);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Send" })));
    expect(calls).toEqual([
      {
        answers: [
          { questionId: "first", type: "skipped" },
          { questionId: "last", type: "skipped" },
        ],
      },
    ]);
  } finally {
    cleanup();
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("mixed pages preserve edits and submit preselected choices only on explicit submission", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const sessions = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const calls: unknown[] = [];
  globalThis.fetch = (async (_url, options) => {
    calls.push(JSON.parse(String(options?.body)));
    return Response.json({});
  }) as typeof fetch;
  const request: UserInputRequest = {
    sessionId: "s",
    requestId: "choice",
    createdAt: 0,
    questions: [
      {
        id: "mode",
        text: "Update strategy?",
        options: [
          { id: "automatic", label: "Automatic" },
          { id: "manual", label: "Manual" },
        ],
        recommendedOptionId: "automatic",
      },
      { id: "details", text: "More details?" },
      { id: "confirm", text: "Continue?", options: [{ id: "yes", label: "Continue" }] },
    ],
  };
  try {
    const ui = render(<UserInputCard request={request} connected />);
    expect(ui.queryByRole("button", { name: "Send" })).toBeNull();
    expect((ui.getByRole("radio", { name: "Automatic" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(ui.getByRole("radio", { name: "Manual" }));
    expect(ui.getByText("2 of 3")).toBeTruthy();
    expect(calls).toEqual([]);
    expect(ui.queryByRole("radio")).toBeNull();
    fireEvent.change(ui.getByRole("textbox"), { target: { value: "Specific requirements" } });
    fireEvent.click(ui.getByRole("button", { name: "Previous" }));
    expect((ui.getByRole("radio", { name: "Automatic" }) as HTMLInputElement).checked).toBe(false);
    expect((ui.getByRole("radio", { name: "Manual" }) as HTMLInputElement).checked).toBe(true);
    expect(
      ui.getByLabelText("Manual").closest("label")?.querySelector(".user-input-number")
        ?.textContent,
    ).toBe("2");
    fireEvent.click(ui.getByRole("radio", { name: "Manual" }));
    expect((ui.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Specific requirements");
    fireEvent.click(ui.getByRole("button", { name: "Next" }));
    expect((ui.getByRole("radio", { name: "Continue" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(ui.getByRole("radio", { name: "Continue" }));
    expect(ui.getByText("3 of 3")).toBeTruthy();
    expect(calls).toEqual([]);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Send" })));
    expect(calls).toEqual([
      {
        answers: [
          { questionId: "mode", type: "option", optionId: "manual" },
          { questionId: "details", type: "text", text: "Specific requirements" },
          { questionId: "confirm", type: "option", optionId: "yes" },
        ],
      },
    ]);
  } finally {
    cleanup();
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
