import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../../shared/protocol";
import { SessionPermissions } from "./SessionPermissions";
import { useSessionPermission } from "../../hooks/useSessionPermission";
import { useSessions } from "../../state/session-store";
import "../../i18n/setup";

test("permission menu requires modal confirmation and keeps the saved preset after cancellation or failure", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useSessions.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, createEvent, act, cleanup, within } = await import(
    "@testing-library/react/pure"
  );
  const snapshot: SessionSnapshot = {
    streamId: "stream",
    sessionId: "first",
    workspaceId: "project",
    operation: "idle",
    tools: {},
    model: { provider: "test", id: "test", name: "Test" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      permissionPreset: "read-only",
    },
  };
  const requests: { url: string; body: unknown }[] = [];
  let resolve!: (response: Response) => void;
  globalThis.fetch = ((url, options) => {
    expect(options?.method).toBe("PUT");
    requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as typeof fetch;
  const Editor = ({
    current = snapshot,
    disabled = false,
  }: {
    current?: SessionSnapshot;
    disabled?: boolean;
  }) => {
    const permission = useSessionPermission(current);
    return (
      <SessionPermissions
        key={current.sessionId}
        snapshot={current}
        disabled={disabled}
        pending={permission.pending}
        error={permission.error}
        select={permission.change}
      />
    );
  };
  try {
    useSessions.setState({ views: {} });
    const ui = render(<Editor />);
    const trigger = () =>
      ui.getByRole("button", { name: "Session permissions: Read only" }) as HTMLButtonElement;
    const openFull = () => {
      fireEvent.click(trigger());
      fireEvent.click(ui.getByRole("menuitemradio", { name: /^Full access/ }));
    };
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    const read = ui.getByRole("menuitemradio", { name: /^Read only/ });
    expect(read.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(read);
    fireEvent.keyDown(read, { key: "End" });
    expect(document.activeElement).toBe(ui.getByRole("menuitemradio", { name: /^Full access/ }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(ui.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    openFull();
    const dialog = ui.getByRole("dialog", { name: "Turn on full access?" });
    expect(requests).toHaveLength(0);
    expect(within(dialog).getByText("Files and folders")).toBeTruthy();
    expect(within(dialog).getByText("Terminal commands")).toBeTruthy();
    expect(within(dialog).getByText("Network access")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(ui.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(requests).toHaveLength(0);
    openFull();
    fireEvent(
      ui.getByRole("dialog"),
      createEvent("cancel", ui.getByRole("dialog"), { bubbles: false, cancelable: true }),
    );
    expect(ui.queryByRole("dialog")).toBeNull();
    openFull();
    fireEvent.click(ui.getByRole("button", { name: "Enable full access" }));
    expect(trigger().disabled).toBe(true);
    expect(requests).toEqual([
      { url: "/api/sessions/first/permission", body: { preset: "danger-full-access" } },
    ]);
    fireEvent(
      ui.getByRole("dialog"),
      createEvent("cancel", ui.getByRole("dialog"), { bubbles: false, cancelable: true }),
    );
    expect(ui.getByRole("dialog")).toBeTruthy();
    await act(async () => {
      resolve(Response.json({ code: "session_busy", message: "Busy" }, { status: 409 }));
    });
    expect(ui.getByRole("dialog")).toBeTruthy();
    expect(ui.getByRole("alert")).toBeTruthy();
    expect(trigger().textContent).toContain("Read only");
    expect(useSessions.getState().views.first?.connected).toBe(false);
    ui.rerender(<Editor disabled />);
    expect(
      (ui.getByRole("button", { name: "Enable full access" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    ui.rerender(<Editor />);
    fireEvent.click(ui.getByRole("button", { name: "Enable full access" }));
    await act(async () => {
      resolve(Response.json({}));
    });
    expect(ui.queryByRole("dialog")).toBeNull();
    expect(trigger().textContent).toContain("Read only");
    const full: SessionSnapshot = {
      ...snapshot,
      state: { ...snapshot.state, permissionPreset: "danger-full-access" },
    };
    ui.rerender(<Editor current={full} />);
    const fullTrigger = ui.getByRole("button", { name: "Session permissions: Full access" });
    expect(fullTrigger.getAttribute("data-full-access")).toBe("true");
    fireEvent.click(fullTrigger);
    fireEvent.click(ui.getByRole("menuitemradio", { name: /^Workspace write/ }));
    expect(ui.queryByRole("dialog")).toBeNull();
    await act(async () => {
      resolve(Response.json({}));
    });
    expect(requests.at(-1)?.body).toEqual({ preset: "workspace-write" });
    ui.rerender(<Editor current={snapshot} />);
    openFull();
    ui.rerender(<Editor current={{ ...snapshot, sessionId: "second" }} />);
    expect(ui.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);
    expect(ui.queryByRole("menu")).toBeNull();
  } finally {
    cleanup();
    useSessions.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
