import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { EchoConversationControls } from "./EchoConversationControls";

test("group conversations choose a responder and invite members", () => {
  const query = new QueryClient();
  const chat = { id: "chat", name: "Team", agentIds: ["one", "two"], responderId: "one" };
  const html = renderToStaticMarkup(
    <QueryClientProvider client={query}>
      <EchoConversationControls
        chat={chat}
        data={{
          version: 1,
          conversations: [chat],
          agents: [
            { id: "one", name: "One", instructions: "" },
            { id: "two", name: "Two", instructions: "" },
            { id: "three", name: "Three", instructions: "" },
          ],
        }}
        onChanged={() => {}}
        onWatch={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(html).toContain("Reply as");
  expect(html).toContain("Invite Agent");
  expect(html).toContain("Three");
  expect(html).not.toContain("echo-desktop");
  query.clear();
});

test("bound computer exposes a delete action", () => {
  const query = new QueryClient();
  const computerId = "a".repeat(32);
  const chat = { id: "chat", name: "Team", agentIds: ["one"], responderId: "one", computerId };
  query.setQueryData(
    ["echo-computers"],
    [{ sandbox_id: computerId, state: "stopped", desktop: true, generation: 1, idle_seconds: 900 }],
  );
  const html = renderToStaticMarkup(
    <QueryClientProvider client={query}>
      <EchoConversationControls
        chat={chat}
        data={{
          version: 1,
          agents: [{ id: "one", name: "One", instructions: "" }],
          conversations: [chat],
          connection: {
            provider: "loop-sandbox",
            endpoint: "https://computer.example",
            idleSeconds: 900,
            desktop: true,
          },
        }}
        onChanged={() => {}}
        onWatch={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(html).toContain("Delete computer");
  expect(html).toContain("Watch desktop");
  query.clear();
});

test("delete confirmation sends DELETE and clears the selected computer", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const computerId = "a".repeat(32);
  const chat = { id: "chat", name: "Team", agentIds: ["one"], responderId: "one", computerId };
  const data = {
    version: 1 as const,
    agents: [{ id: "one", name: "One", instructions: "" }],
    conversations: [chat],
    connection: {
      provider: "loop-sandbox" as const,
      endpoint: "https://computer.example",
      idleSeconds: 900,
      desktop: true,
    },
  };
  query.setQueryData(
    ["echo-computers"],
    [{ sandbox_id: computerId, state: "stopped", desktop: true, generation: 1, idle_seconds: 900 }],
  );
  const fetch = vi.fn(async (path: string) =>
    Response.json(path === "/api/echo/computers" ? [] : { state: "destroyed" }),
  );
  globalThis.fetch = fetch;
  const changed = vi.fn();
  const watch = vi.fn();
  try {
    const view = render(
      <QueryClientProvider client={query}>
        <EchoConversationControls chat={chat} data={data} onChanged={changed} onWatch={watch} />
      </QueryClientProvider>,
    );
    fireEvent.click(view.getByRole("button", { name: "Delete computer" }));
    const dialog = view.getByRole("dialog", { name: "Delete computer" });
    fireEvent.click(dialog.querySelector(".echo-computer-delete-confirm")!);
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([path, init]) =>
            path === "/api/echo/computers/" + computerId && init?.method === "DELETE",
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(watch).toHaveBeenCalledWith(undefined);
  } finally {
    cleanup();
    query.clear();
    globalThis.fetch = previous.fetch;
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    await window.happyDOM.close();
  }
});
