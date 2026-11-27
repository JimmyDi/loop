import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";
import "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { useRef } from "react";
import { ScheduleRunHistory } from "./ScheduleRunHistory";

const History = () => {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <div ref={viewport}>
      <ScheduleRunHistory viewport={viewport} />
    </div>
  );
};

test("loads the first page and appends older runs on request", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const observers: (() => void)[] = [];
  Object.assign(window, {
    IntersectionObserver: class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        observers.push(() => callback([{ isIntersecting: true }]));
      }
      observe() {}
      disconnect() {}
    },
  });
  const workspace = useWorkspace.getState();
  const cursor = { scheduledFor: Date.now(), scheduleId: "task", id: "latest" };
  let archived = false;
  const fetch = vi.fn(async (path: string) => {
    if (path.endsWith("/archive")) {
      archived = true;
      return new Response(null, { status: 204 });
    }
    const older = path.includes("?after=");
    return Response.json({
      runs: [
        {
          ...cursor,
          id: older ? "older" : cursor.id,
          status: "completed",
          archived: !older && archived,
          sessionId: older ? undefined : "chat",
          input: { name: older ? "Older run" : "Latest run", projectId: "project" },
        },
      ],
      nextCursor: older ? null : cursor,
    });
  });
  Object.assign(globalThis, { window, document: window.document, fetch });
  const { render, fireEvent, cleanup, act, waitFor, within } = await import(
    "@testing-library/react/pure"
  );
  const client = new QueryClient();
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <History />
      </QueryClientProvider>,
    );
    expect(await ui.findByText("Latest run")).toBeTruthy();
    expect(ui.queryByText("Older run")).toBeNull();
    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    act(() => observers.at(-1)?.());
    expect(await ui.findByText("Older run")).toBeTruthy();
    expect(ui.getByText("Latest run")).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Load older runs" })).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/schedules/runs/page",
      "/api/schedules/runs/page?after=" + cursor.scheduledFor + "%2Ftask%2Flatest",
    ]);
    const today = ui.getByRole("button", { name: "Today" });
    expect(today.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(today);
    expect(ui.queryByText("Latest run")).toBeNull();
    fireEvent.click(today);
    fireEvent.click(ui.getByRole("button", { name: /^Latest run/ }));
    expect(useWorkspace.getState().active).toEqual({ id: "chat", workspaceId: "project" });
    const latest = ui.getByText("Latest run").closest<HTMLElement>(".automation-run")!;
    fireEvent.click(within(latest).getByRole("button", { name: "Archive run" }));
    await waitFor(() => {
      expect(ui.getByRole("button", { name: "Archived" })).toBeTruthy();
      expect(
        within(ui.getByText("Latest run").closest<HTMLElement>(".automation-run")!).getByRole(
          "button",
          {
            name: "Restore run",
          },
        ),
      ).toBeTruthy();
    });
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace);
    await nextTick();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
