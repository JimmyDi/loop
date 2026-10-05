import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { ListChange, SessionSummary } from "../../shared/protocol";

class LocalSource {
  static connections: LocalSource[] = [];
  onmessage?: (event: { data: string }) => void;
  closed = false;
  constructor(readonly url: string) {
    LocalSource.connections.push(this);
  }
  send(change: ListChange, seq: number, streamId = "stream") {
    this.onmessage?.({ data: JSON.stringify({ ...change, seq, streamId }) });
  }
  close() {
    this.closed = true;
  }
}

const setup = async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  LocalSource.connections = [];
  const testing = await import("@testing-library/react/pure");
  const { useListEvents } = await import("./useListEvents");
  const clients: QueryClient[] = [];
  const page = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
    clients.push(client);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  };
  return {
    ...testing,
    useListEvents,
    page,
    finish: async () => {
      testing.cleanup();
      for (const client of clients) client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    },
  };
};

test("list notifications batch across pages, target projects, and resync after reconnect or gaps", async () => {
  const env = await setup();
  const observers: { destroy(): void }[] = [];
  try {
    const pages = [env.page(), env.page()].map(({ client, wrapper }) => {
      const counts = { p: 0, q: 0, projects: 0, archives: 0, unrelated: 0 };
      const keys = {
        p: ["sessions", "p"],
        q: ["sessions", "q"],
        projects: ["projects"],
        archives: ["archived-chats"],
        unrelated: ["models"],
      };
      for (const name of Object.keys(keys) as (keyof typeof keys)[]) {
        client.setQueryData(keys[name], 0);
        const observer = new QueryObserver(client, {
          queryKey: keys[name],
          queryFn: async () => ++counts[name],
        });
        observer.subscribe(() => {});
        observers.push(observer);
      }
      const hook = env.renderHook(env.useListEvents, { wrapper });
      return { counts, hook, source: LocalSource.connections.at(-1)! };
    });
    const broadcast = (change: ListChange, seq: number, streamId?: string) => {
      for (const page of pages) page.source.send(change, seq, streamId);
    };
    await env.act(async () => {
      broadcast({ type: "lists.reset" }, 0);
      await sleep(90);
    });
    for (const { counts } of pages)
      expect(counts).toEqual({ p: 1, q: 1, projects: 1, archives: 1, unrelated: 0 });
    await env.act(async () => {
      broadcast({ type: "sessions.changed", workspaceId: "p" }, 1);
      broadcast({ type: "sessions.changed", workspaceId: "p" }, 2);
      broadcast({ type: "sessions.changed", workspaceId: "p" }, 2);
      await sleep(90);
    });
    for (const { counts } of pages)
      expect(counts).toEqual({ p: 2, q: 1, projects: 1, archives: 2, unrelated: 0 });
    await env.act(async () => {
      broadcast({ type: "projects.changed", workspaceId: "q" }, 3);
      await sleep(90);
    });
    for (const { counts } of pages)
      expect(counts).toEqual({ p: 2, q: 2, projects: 2, archives: 3, unrelated: 0 });
    // Native EventSource reconnect can reset at the same sequence. It must still refetch.
    await env.act(async () => {
      broadcast({ type: "lists.reset" }, 3);
      await sleep(90);
      broadcast({ type: "sessions.changed", workspaceId: "p" }, 5);
      await sleep(90);
      broadcast({ type: "sessions.changed", workspaceId: "p" }, 1, "restarted");
      await sleep(90);
    });
    for (const { counts, hook, source } of pages) {
      expect(counts).toEqual({ p: 5, q: 5, projects: 5, archives: 6, unrelated: 0 });
      hook.rerender();
      expect(source.closed).toBe(false);
      source.send({ type: "sessions.changed", workspaceId: "p" }, 2, "restarted");
      hook.unmount();
      expect(source.closed).toBe(true);
      source.send({ type: "lists.reset" }, 3, "restarted");
    }
    await sleep(90);
    expect(LocalSource.connections).toHaveLength(2);
    for (const { counts } of pages) expect(counts.p).toBe(5);
  } finally {
    for (const observer of observers) observer.destroy();
    await env.finish();
  }
});

test("an expanded project remains idle past the old poll interval and refreshes only on a change", async () => {
  const env = await setup();
  const previousFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return Response.json([]);
    }) as unknown as typeof fetch;
    const { useProjectSessions } = await import("./useProjectSessions");
    const { wrapper } = env.page();
    env.renderHook(
      () => {
        env.useListEvents();
        return useProjectSessions("p", true);
      },
      { wrapper },
    );
    await env.waitFor(() => expect(calls).toBe(1));
    const source = LocalSource.connections[0]!;
    await env.act(async () => {
      source.send({ type: "lists.reset" }, 0);
      await sleep(90);
    });
    expect(calls).toBe(2);
    await env.act(async () => {
      await sleep(5100);
    });
    expect(calls).toBe(2);
    await env.act(async () => {
      source.send({ type: "sessions.changed", workspaceId: "p" }, 1);
      await sleep(90);
    });
    expect(calls).toBe(3);
  } finally {
    globalThis.fetch = previousFetch;
    await env.finish();
  }
}, 10000);

test("events cancel stale initial fetches and retain notifications received during a refresh", async () => {
  const env = await setup();
  const { client, wrapper } = env.page();
  let calls = 0;
  const pending: { resolve: (value: string) => void; signal: AbortSignal }[] = [];
  const observer = new QueryObserver(client, {
    queryKey: ["sessions", "p"],
    queryFn: ({ signal }) => {
      calls++;
      return new Promise<string>((resolve) => pending.push({ resolve, signal }));
    },
  });
  observer.subscribe(() => {});
  try {
    const hook = env.renderHook(env.useListEvents, { wrapper });
    const source = LocalSource.connections[0]!;
    expect(calls).toBe(1);
    await env.act(async () => {
      source.send({ type: "lists.reset" }, 0);
      await sleep(90);
    });
    expect(calls).toBe(2);
    expect(pending[0]!.signal.aborted).toBe(true);
    await env.act(async () => {
      source.send({ type: "sessions.changed", workspaceId: "p" }, 1);
      pending[0]!.resolve("stale");
      pending[1]!.resolve("before notification");
      await sleep(90);
    });
    expect(calls).toBe(3);
    await env.act(async () => {
      pending[2]!.resolve("latest");
      await sleep(10);
    });
    expect(client.getQueryData<string>(["sessions", "p"])).toBe("latest");
    await env.act(async () => {
      source.send({ type: "sessions.changed", workspaceId: "p" }, 2);
      await sleep(90);
      source.send({ type: "sessions.changed", workspaceId: "p" }, 3);
      hook.unmount();
      pending[3]!.resolve("final");
      await sleep(90);
    });
    expect(calls).toBe(4);
    expect(source.closed).toBe(true);
  } finally {
    observer.destroy();
    await env.finish();
  }
});

test("a receipt saved in another browser clears unread through list refresh, including after reconnect", async () => {
  const env = await setup();
  const previousFetch = globalThis.fetch;
  const { client, wrapper } = env.page();
  let unread = true;
  const summary = {
    id: "shared-session",
    workspaceId: "p",
    title: "Example",
    createdAt: "",
    updatedAt: "",
    messageCount: 2,
    userMessageCount: 1,
  };
  globalThis.fetch = (async () =>
    Response.json([{ ...summary, unread }])) as unknown as typeof fetch;
  try {
    const { useProjectSessions } = await import("./useProjectSessions");
    const { SessionList } = await import("../components/projects/SessionList");
    await import("../i18n/setup");
    const Page = () => {
      env.useListEvents();
      const { sessions } = useProjectSessions("p", true);
      return <SessionList sessions={sessions.data ?? []} />;
    };
    const ui = env.render(<Page />, { wrapper });
    await env.waitFor(() => expect(ui.getByRole("img", { name: "Unread" })).toBeTruthy());
    const source = LocalSource.connections[0]!;
    await env.act(async () => {
      unread = false;
      source.send({ type: "sessions.changed", workspaceId: "p" }, 1);
      await sleep(90);
    });
    expect(ui.queryByRole("img", { name: "Unread" })).toBeNull();
    await env.act(async () => {
      unread = true;
      summary.messageCount = 4;
      summary.userMessageCount = 2;
      source.send({ type: "sessions.changed", workspaceId: "p" }, 2);
      await sleep(90);
    });
    expect(ui.getByRole("img", { name: "Unread" })).toBeTruthy();
    await env.act(async () => {
      unread = false;
      source.send({ type: "lists.reset" }, 0, "restarted");
      await sleep(90);
    });
    expect(ui.queryByRole("img", { name: "Unread" })).toBeNull();
    expect(client.getQueryData<SessionSummary[]>(["sessions", "p"])).toEqual([
      { ...summary, unread: false },
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    await env.finish();
  }
});

test("server pin notifications update collapsed project pins on other pages and reconnect", async () => {
  const env = await setup();
  const previousFetch = globalThis.fetch;
  const { wrapper } = env.page();
  let pinnedAt: string | undefined;
  const summary: SessionSummary = {
    id: "shared-pin",
    workspaceId: "p",
    title: "Example",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    messageCount: 1,
    userMessageCount: 1,
  };
  globalThis.fetch = (async (_url) => Response.json([{ ...summary, pinnedAt }])) as typeof fetch;
  try {
    const { PinnedSessions } = await import("../components/projects/PinnedSessions");
    await import("../i18n/setup");
    const Page = () => {
      env.useListEvents();
      return <PinnedSessions projects={[{ id: "p", name: "Example", cwd: "/example" }]} />;
    };
    const ui = env.render(<Page />, { wrapper });
    const source = LocalSource.connections[0]!;
    await env.act(async () => {
      source.send({ type: "lists.reset" }, 0);
      await sleep(90);
    });
    expect(ui.queryByRole("region", { name: "Pinned" })).toBeNull();
    await env.act(async () => {
      pinnedAt = "2026-01-02T00:00:00.000Z";
      source.send({ type: "sessions.changed", workspaceId: "p" }, 1);
      await sleep(90);
    });
    expect(ui.getByRole("button", { name: "Unpin Example" })).toBeTruthy();
    await env.act(async () => {
      pinnedAt = undefined;
      source.send({ type: "sessions.changed", workspaceId: "p" }, 2);
      await sleep(90);
    });
    expect(ui.queryByRole("region", { name: "Pinned" })).toBeNull();
    await env.act(async () => {
      pinnedAt = "2026-01-03T00:00:00.000Z";
      source.send({ type: "lists.reset" }, 0, "restarted");
      await sleep(90);
    });
    expect(ui.getByRole("button", { name: "Unpin Example" })).toBeTruthy();
  } finally {
    globalThis.fetch = previousFetch;
    await env.finish();
  }
});
