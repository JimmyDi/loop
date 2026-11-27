import { setImmediate as nextTick } from "node:timers/promises";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";
import "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { AutomationPage } from "./AutomationPage";

test("opens creation from both layouts and reads history independently of existing tasks", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["schedules"], []);
  client.setQueryData(["projects"], []);
  client.setQueryData(["schedule-runs"], {
    pages: [
      {
        runs: [
          {
            id: "first",
            scheduleId: "removed",
            input: { name: "Past review" },
            scheduledFor: 100,
            status: "completed",
          },
        ],
        nextCursor: null,
      },
    ],
    pageParams: [null],
  });
  const workspace = useWorkspace.getState();
  const chat = { id: "previous-chat", workspaceId: null };
  try {
    workspace.open(chat);
    workspace.showAutomation(true);
    const ui = render(
      <QueryClientProvider client={client}>
        <AutomationPage />
      </QueryClientProvider>,
    );
    expect(ui.getByText("Create your first automation")).toBeTruthy();
    const add = () => fireEvent.click(ui.getByRole("button", { name: "Add automation" }));
    add();
    expect(ui.getByRole("textbox", { name: "Instructions" })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    fireEvent.click(ui.getByRole("button", { name: "Run history" }));
    expect(ui.getByText("Past review")).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Scheduled tasks" }));
    await act(async () => {
      client.setQueryData(
        ["schedules"],
        [
          {
            id: "demo",
            name: "Daily review",
            trigger: { kind: "cron", expression: "0 9 * * *", timezone: "UTC" },
            status: "paused",
            next: null,
          },
        ],
      );
    });
    expect(await ui.findByText("Daily review")).toBeTruthy();
    expect(
      ui.container
        .querySelector("header")!
        .contains(ui.getByRole("button", { name: "Add automation" })),
    ).toBe(true);
    add();
    expect(ui.getByRole("textbox", { name: "Instructions" })).toBeTruthy();
    expect(ui.queryByRole("dialog")).toBeNull();
    expect(ui.queryByRole("button", { name: "Scheduled tasks" })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "Automation" }));
    const back = ui.getByRole("button", { name: "Back to chat" });
    expect(back.nextElementSibling).toBe(ui.getByRole("group", { name: "Automation" }));
    fireEvent.click(back);
    expect(useWorkspace.getState()).toMatchObject({ active: chat, automation: false });
  } finally {
    useWorkspace.setState(workspace);
    cleanup();
    client.clear();
    await nextTick();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("retains a failed edit and returns to the list after saving the current form", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    FormData: globalThis.FormData,
    Event: globalThis.Event,
    fetch: globalThis.fetch,
  };
  const plan = {
    id: "demo",
    name: "Review",
    projectId: "demo",
    prompt: "Original",
    permission: "read-only",
    missed: "skip",
    status: "paused",
    next: null,
    trigger: { kind: "interval", anchorAt: 100, everyMs: 60000 },
  };
  let attempts = 0;
  let ran = false;
  let deleted = false;
  Object.assign(globalThis, {
    window,
    document: window.document,
    FormData: window.FormData,
    Event: window.Event,
    fetch: async (path: string, init: RequestInit) => {
      if (path === "/api/schedules/preview") return Response.json([]);
      if (path === "/api/schedules/demo/run" && init.method === "POST") {
        expect(JSON.parse(String(init.body))).toHaveProperty("requestId");
        ran = true;
        return Response.json({ id: "manual-demo", status: "queued" });
      }
      if (path === "/api/schedules/demo" && init.method === "DELETE") {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      if (path === "/api/schedules/runs/page")
        return Response.json({
          runs: [
            {
              id: "manual-demo",
              scheduleId: "demo",
              input: plan,
              status: "running",
              scheduledFor: 100,
              sessionId: "run-chat",
            },
          ],
          nextCursor: null,
        });
      if (init.method === "PUT") {
        expect(path).toBe("/api/schedules/demo");
        expect(JSON.parse(String(init.body))).toMatchObject({
          prompt: "Revised",
          permission: "danger-full-access",
          trigger: plan.trigger,
        });
        attempts++;
        if (attempts === 1) return Response.json({ message: "Save failed" }, { status: 500 });
        return Response.json(plan);
      }
      return Response.json(deleted ? [] : [plan]);
    },
  });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["schedules"], [plan]);
  client.setQueryData(["projects"], [{ id: "demo", name: "Demo", accessible: true }]);
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <AutomationPage />
      </QueryClientProvider>,
    );
    fireEvent.click(ui.getByRole("img", { name: "Paused" }));
    expect(ui.getByRole("heading", { name: "Review" })).toBeTruthy();
    const save = ui.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.closest("header")?.parentElement).toBe(ui.getByRole("main"));
    expect(save.form).toBe(ui.container.querySelector("form"));
    const prompt = ui.getByRole("textbox", { name: "Instructions" }) as HTMLTextAreaElement;
    fireEvent.change(prompt, { target: { value: "Revised" } });
    fireEvent.click(ui.getByRole("button", { name: "Permissions" }));
    fireEvent.click(ui.getByRole("option", { name: "Full access" }));
    fireEvent.click(ui.getByRole("button", { name: "Save" }));
    expect(await ui.findByText("Save failed")).toBeTruthy();
    expect(prompt.value).toBe("Revised");
    fireEvent.click(ui.getByRole("button", { name: "Save" }));
    expect(await ui.findByRole("button", { name: "Review" })).toBeTruthy();
    expect(attempts).toBe(2);
    fireEvent.click(ui.getByRole("button", { name: "Test run" }));
    await vi.waitFor(() => {
      expect(ran).toBe(true);
      expect((ui.getByRole("button", { name: "Test run" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    expect(ui.getByRole("button", { name: "Scheduled tasks" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(ui.getByRole("button", { name: "Run history" }));
    expect(await ui.findByRole("img", { name: "Running" })).toBeTruthy();
    expect(ui.getByRole("button", { name: /^Review/ })).toBeTruthy();
    fireEvent.click(ui.getByRole("button", { name: "Scheduled tasks" }));
    fireEvent.click(ui.getByRole("button", { name: "Review" }));
    fireEvent.click(ui.getByRole("button", { name: "Run now" }));
    const remove = ui.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    await vi.waitFor(() => {
      expect(ran).toBe(true);
      expect(remove.disabled).toBe(false);
    });
    fireEvent.click(remove);
    expect(await ui.findByText("Create your first automation")).toBeTruthy();
    expect(deleted).toBe(true);
  } finally {
    cleanup();
    client.clear();
    await nextTick();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["success", "rejected", "cancelled"])(
  "shows a manual run in its project before the request resolves: %s",
  async (outcome) => {
    const { Sidebar } = await import("../layout/Sidebar");
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    const project = { id: "project", cwd: "/example", name: "Example" };
    const plan = {
      id: "task",
      projectId: project.id,
      name: "Daily review",
      status: "active",
      next: null,
      trigger: { kind: "interval", everyMs: 60000 },
    };
    const post = Promise.withResolvers<Response>();
    let status = "queued";
    const run = () => ({
      id: "run",
      scheduleId: plan.id,
      input: plan,
      status,
      scheduledFor: 100,
      sessionId: status === "running" ? "chat" : undefined,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["schedules"], [plan]);
    client.setQueryData(["projects"], [project]);
    const chat = {
      id: "chat",
      workspaceId: project.id,
      title: "Review chat",
      userMessageCount: 1,
      isGenerating: true,
    };
    const requests: string[] = [];
    const fetch = async (path: string) => {
      requests.push(path);
      if (path.endsWith("/task/runs/run")) return Response.json(run());
      if (path.endsWith("/task/run")) return post.promise;
      if (path.endsWith("/schedules/runs")) return Response.json([run()]);
      if (path.endsWith("/schedules")) return Response.json([plan]);
      if (path.endsWith("workspaceId=project") && status === "running")
        return Response.json([chat]);
      return Response.json([]);
    };
    Object.assign(globalThis, { window, document: window.document, fetch });
    const { render, fireEvent, waitFor, within, cleanup, act } = await import(
      "@testing-library/react/pure"
    );
    try {
      workspace.expand(project.id, false);
      const ui = render(
        <QueryClientProvider client={client}>
          <Sidebar />
          <AutomationPage />
        </QueryClientProvider>,
      );
      const sidebar = within(ui.getByRole("complementary"));
      fireEvent.click(ui.getByRole("button", { name: plan.name }));
      fireEvent.click(ui.getByRole("button", { name: "Run now" }));
      expect((await sidebar.findByRole("img", { name: "Submitting…" })).className).toBe(
        "session-list-spinner",
      );
      expect(sidebar.queryByText("Submitting…")).toBeNull();
      expect(sidebar.getByText(plan.name)).toBeTruthy();
      expect(requests.some((path) => path.endsWith("/task/runs/run"))).toBe(false);
      if (outcome === "rejected") {
        post.resolve(Response.json({ message: "Run rejected" }, { status: 409 }));
        expect(await ui.findByText("Run rejected")).toBeTruthy();
      } else {
        post.resolve(Response.json(run()));
        expect((await sidebar.findByRole("img", { name: "Queued" })).className).toBe(
          "session-list-spinner",
        );
        expect(sidebar.queryByText("Queued")).toBeNull();
        status = outcome === "cancelled" ? "cancelled" : "running";
        await waitFor(() => expect(requests).toContain("/api/schedules/task/runs/run"));
        await act(async () => {
          await client.invalidateQueries({ queryKey: ["schedule-run-progress"] });
        });
        if (outcome === "success") {
          const openChat = await sidebar.findByRole("button", { name: /^Review chat/ });
          expect(within(openChat).getByRole("img", { name: "Looping..." }).className).toBe(
            "session-list-spinner",
          );
          await act(async () => {
            client.setQueryData(
              ["sessions", project.id],
              [{ ...chat, isGenerating: false, unread: true }],
            );
          });
          expect((await within(openChat).findByRole("img", { name: "Unread" })).className).toBe(
            "session-list-unread",
          );
          expect(within(openChat).queryByRole("img", { name: "Looping..." })).toBeNull();
          fireEvent.click(openChat);
          expect(useWorkspace.getState().active?.id).toBe("chat");
        }
      }
      await waitFor(() => expect(sidebar.queryByText(plan.name)).toBeNull());
      const count = requests.length;
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["schedule-run-progress"] });
      });
      expect(requests).toHaveLength(count);
      expect(requests).not.toContain("/api/schedules/runs/page");
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test.each(["Scheduled tasks", "Run history"])(
  "refreshes %s as soon as the scheduler reports a change",
  async (tab) => {
    const { useListEvents } = await import("../../hooks/useListEvents");
    const window = new Window();
    let source: LocalSource;
    class LocalSource {
      onmessage?: (event: { data: string }) => void;
      constructor() {
        source = this;
      }
      send(type: string, seq: number) {
        this.onmessage?.({ data: JSON.stringify({ type, streamId: "stream", seq }) });
      }
      close() {}
    }
    const plan = {
      id: "task",
      name: "One-time review",
      projectId: "project",
      trigger: { kind: "once", at: Date.now() - 1000 },
      status: "completed",
      next: null,
    };
    const run = { id: "run", scheduleId: plan.id, input: plan, scheduledFor: 100 };
    const running = { ...run, status: "running" };
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
      EventSource: globalThis.EventSource,
    };
    let finished = false;
    const fetch = vi.fn(async (path: string) => {
      if (path === "/api/schedules/runs/page") {
        return Response.json({
          runs: [finished ? { ...run, status: "completed" } : running],
          nextCursor: null,
        });
      }
      return Response.json([finished ? plan : { ...plan, activeRun: running }]);
    });
    Object.assign(globalThis, {
      window,
      document: window.document,
      fetch,
      EventSource: LocalSource,
    });
    const { render, cleanup, fireEvent, act, waitFor } = await import(
      "@testing-library/react/pure"
    );
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(["projects"], []);
    const Page = () => {
      useListEvents();
      return <AutomationPage />;
    };
    try {
      const history = tab === "Run history";
      const ui = render(
        <QueryClientProvider client={client}>
          <Page />
        </QueryClientProvider>,
      );
      if (history) fireEvent.click(ui.getByRole("button", { name: tab }));
      const runningStatus = () => ui.queryByRole("img", { name: "Running" });
      await waitFor(() => expect(runningStatus()).toBeTruthy());
      source!.send("lists.reset", 0);
      await waitFor(() =>
        expect(
          fetch.mock.calls.filter(([url]) => url.endsWith(history ? "/runs/page" : "/schedules")),
        ).toHaveLength(2),
      );
      await waitFor(() => expect(client.isFetching()).toBe(0));
      fetch.mockClear();
      act(() => {
        finished = true;
        source!.send("schedules.changed", 1);
        source!.send("schedules.changed", 2);
      });
      if (history) expect(await ui.findByRole("img", { name: "Completed" })).toBeTruthy();
      else {
        expect(await ui.findByRole("img", { name: "Completed" })).toBeTruthy();
        expect(ui.getByRole("button", { name: "Test run" })).toBeTruthy();
      }
      expect(runningStatus()).toBeNull();
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        history ? "/api/schedules/runs/page" : "/api/schedules",
      ]);
    } finally {
      cleanup();
      client.clear();
      await nextTick();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
