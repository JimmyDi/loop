import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { SessionStatus } from "./SessionStatus";

const snapshot: SessionSnapshot = {
  streamId: "stream",
  sessionId: "test",
  workspaceId: "project",
  model: { id: "test", name: "Test", provider: "test" },
  operation: "prompt",
  tools: {},
  state: {
    messages: [],
    isRunning: true,
    hasPendingSave: false,
    outcome: "idle",
    listenerErrors: [],
  },
};

test("SessionStatus renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionStatus
        snapshot={{
          ...snapshot,
          operation: "idle",
          state: { ...snapshot.state, hasPendingSave: true },
        }}
        connected
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("unsaved changes");
  expect(html).toContain("Retry save");
  client.clear();
});

test("routine session states leave no status row above the input", () => {
  for (const outcome of ["idle", "success", "cancelled"] as const) {
    const html = renderToStaticMarkup(
      <SessionStatus
        snapshot={{
          ...snapshot,
          operation: "idle",
          state: { ...snapshot.state, isRunning: false, outcome },
        }}
        connected
      />,
    );
    expect(html).toBe("");
  }
  expect(renderToStaticMarkup(<SessionStatus snapshot={snapshot} connected />)).toBe("");
});

test("brief session connection does not show a reconnect warning", () => {
  const html = renderToStaticMarkup(<SessionStatus snapshot={snapshot} connected={false} />);

  expect(html).toBe("");
});

test("persistent disconnection shows retry after a grace period and resets on session switch", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, act, cleanup } = await import("@testing-library/react/pure");
  vi.useFakeTimers();
  try {
    const view = render(<SessionStatus snapshot={snapshot} connected={false} />);
    expect(view.queryByText("Reconnecting…")).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy();
    view.rerender(
      <SessionStatus snapshot={{ ...snapshot, sessionId: "other" }} connected={false} />,
    );
    expect(view.queryByRole("button", { name: "Retry" })).toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    view.rerender(<SessionStatus snapshot={{ ...snapshot, sessionId: "other" }} connected />);
    act(() => vi.advanceTimersByTime(2_000));
    expect(view.queryByRole("button", { name: "Retry" })).toBeNull();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new window.Event("offline")));
    view.rerender(<SessionStatus snapshot={snapshot} connected={false} />);
    expect(view.getByRole("button", { name: "Retry" }).hasAttribute("disabled")).toBe(true);
  } finally {
    cleanup();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("a failed model connection leaves the running state and shows configuration guidance", () => {
  const html = renderToStaticMarkup(
    <SessionStatus
      snapshot={{
        ...snapshot,
        operation: "idle",
        state: {
          ...snapshot.state,
          isRunning: false,
          outcome: "error",
          error: "Connection error.",
        },
      }}
      connected
    />,
  );

  expect(html).toContain("Connection error.");
  expect(html).toContain('aria-label="Close"');
  expect(html).toContain("Open Settings → Models");
  expect(html).not.toContain("Looping...");
});

test("legacy no-work state does not duplicate the local notice or hide real errors", () => {
  const current: SessionSnapshot = {
    ...snapshot,
    operation: "idle",
    commandError: "Nothing to compact",
    state: { ...snapshot.state, error: "Nothing to compact", outcome: "error" },
  };
  expect(renderToStaticMarkup(<SessionStatus snapshot={current} connected />)).toBe("");
  expect(
    renderToStaticMarkup(
      <SessionStatus
        snapshot={{
          ...current,
          state: {
            ...current.state,
            error: "Disk full",
          },
        }}
        connected
      />,
    ),
  ).toContain("Disk full");
});
