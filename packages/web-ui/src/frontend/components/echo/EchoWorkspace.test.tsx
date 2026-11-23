import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { EchoWorkspace } from "./EchoWorkspace";

test("Echo exposes Agent creation and group chats without project creation", () => {
  const query = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={query}>
      <EchoWorkspace />
    </QueryClientProvider>,
  );
  expect(html).toContain("New Agent");
  expect(html).toContain("New group chat");
  expect(html).not.toContain('type="checkbox"');
  expect(html).not.toContain("echo-settings");
  expect(html).not.toContain("Create project");
  query.clear();
});

test("a bound desktop opens by default and stays closed when dismissed", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor, act } = await import("@testing-library/react/pure");
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const computerId = "a".repeat(32);
  const chat = {
    id: "chat",
    name: "Team",
    agentIds: ["agent", "other"],
    responderId: "agent",
    computerId,
  };
  query.setQueryData(["echo"], {
    version: 1,
    agents: [
      { id: "agent", name: "Agent", instructions: "" },
      { id: "other", name: "Other", instructions: "" },
    ],
    conversations: [chat],
    connection: {
      provider: "loop-sandbox",
      endpoint: "https://computer.example",
      idleSeconds: 900,
      desktop: true,
    },
  });
  query.setQueryData(
    ["echo-computers"],
    [{ sandbox_id: computerId, state: "stopped", desktop: true, generation: 1, idle_seconds: 900 }],
  );
  try {
    const view = render(
      <QueryClientProvider client={query}>
        <EchoWorkspace />
      </QueryClientProvider>,
    );
    fireEvent.click(view.getByRole("button", { name: "Team" }));
    await waitFor(() =>
      expect(view.getByRole("complementary", { name: "Sandbox desktop" })).toBeTruthy(),
    );
    fireEvent.click(
      view.getByRole("complementary", { name: "Sandbox desktop" }).querySelector("button")!,
    );
    expect(view.queryByRole("complementary", { name: "Sandbox desktop" })).toBeNull();
    await act(async () => {
      query.setQueryData(
        ["echo-computers"],
        [
          {
            sandbox_id: computerId,
            state: "running",
            desktop: true,
            generation: 1,
            idle_seconds: 900,
          },
        ],
      );
    });
    expect(view.queryByRole("complementary", { name: "Sandbox desktop" })).toBeNull();
  } finally {
    await act(async () => {
      cleanup();
      query.clear();
    });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
