import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../../shared/protocol";
import { i18n } from "../../i18n/setup";
import { useRequests } from "../../state/request-store";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import { ChatComposer } from "./ChatComposer";
import { ComposerCommands } from "./ComposerCommands";

const snapshot: SessionSnapshot = {
  sessionId: "test",
  streamId: "stream",
  workspaceId: "project",
  model: { provider: "test", id: "model", name: "Test" },
  operation: "idle",
  tools: {},
  state: {
    messages: [1, 2].map((timestamp) => ({ role: "user", content: "Task", timestamp })),
    isRunning: false,
    hasPendingSave: false,
    outcome: "idle",
    listenerErrors: [],
    contextBudget: {
      provider: "test",
      model: "model",
      contextWindow: 10000,
      estimatedInputTokens: 5600,
      systemTokens: 100,
      messageTokens: 5000,
      toolTokens: 500,
      reservedOutputTokens: 1000,
      safetyTokens: 500,
      inputLimit: 8500,
      remainingInputTokens: 2900,
      fits: true,
    },
  },
};

test.each([0, 3, 50, 100, 120, undefined])(
  "Compact ring matches displayed usage %s without footer explanations",
  (percent) => {
    const current = structuredClone(snapshot);
    if (percent === undefined) current.state.contextBudget = undefined;
    else current.state.contextBudget!.estimatedInputTokens = percent * 100;
    const html = renderToStaticMarkup(
      <ComposerCommands
        snapshot={current}
        text="/"
        disabled={false}
        commandDisabled={false}
        onCompact={() => {}}
      />,
    );
    expect(html).not.toContain("<small");
    expect(html).not.toContain("Enter to compact");
    expect(html).not.toContain("Latest request input estimate");
    if (percent !== undefined) expect(html).toContain(`${percent}% full`);
    else expect(html).not.toContain("% full");
    if (percent) {
      expect(html).toContain('pathLength="100"');
      expect(html).toContain(`stroke-dasharray="${Math.min(100, percent)} 100"`);
      expect(html).toContain('transform="rotate(-90 12 12)"');
      expect(html).toContain('stroke-linecap="butt"');
    } else expect(html).not.toContain("composer-command-ring-fill");
  },
);

test("disabled compaction keeps its context percentage and matching ring", () => {
  const html = renderToStaticMarkup(
    <ComposerCommands
      snapshot={snapshot}
      text="/"
      disabled={false}
      commandDisabled
      onCompact={() => {}}
    />,
  );
  expect(html).toContain("56% full");
  expect(html).toContain('stroke-dasharray="56 100"');
  expect(html).toContain('aria-disabled="true"');
});

test("short-context command is unavailable before clicking and explains why on hover", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
  client.setQueryData(["models"], [snapshot.model]);
  globalThis.fetch = vi.fn();
  try {
    useWorkspace.setState({ drafts: { test: "/" }, images: {}, files: {}, skills: {} });
    const view = render(
      <QueryClientProvider client={client}>
        <ChatComposer
          snapshot={{ ...snapshot, state: { ...snapshot.state, compactionAvailable: false } }}
          connected
        />
      </QueryClientProvider>,
    );
    const option = view.getByRole("option");
    expect(option.getAttribute("aria-disabled")).toBe("true");
    expect(option.getAttribute("title")).toBe(i18n.t("errors.nothing_to_compact"));
    expect(option.textContent).toContain("56% full");
    fireEvent.click(option);
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    fireEvent.submit(view.container.querySelector("form")!);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(useWorkspace.getState().drafts.test).toBe("/");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("slash menu filters commands, shows estimated usage, dismisses and avoids submitting while unavailable or composing", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const compact = vi.fn();
  const submit = vi.fn();
  try {
    await i18n.changeLanguage("en");
    const content = (text: string, commandDisabled = false) => (
      <form>
        <div role="textbox" onKeyDown={submit} />
        <ComposerCommands
          snapshot={snapshot}
          text={text}
          disabled={false}
          commandDisabled={commandDisabled}
          onCompact={compact}
        />
      </form>
    );
    const view = render(content("/"));
    expect(view.getByRole("option").textContent).toContain("56% full · estimated");
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter", isComposing: true, keyCode: 229 });
    expect(compact).not.toHaveBeenCalled();
    submit.mockClear();
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Escape" });
    expect(view.queryByRole("listbox")).toBeNull();
    view.rerender(content("/"));
    expect(view.queryByRole("listbox")).toBeNull();
    view.rerender(content(""));
    view.rerender(content("/"));
    expect(view.getByRole("listbox")).toBeTruthy();
    expect(view.getByRole("textbox").getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(view.queryByRole("listbox")).toBeNull();
    view.rerender(content(""));
    view.rerender(content("/", true));
    expect(view.getByRole("listbox")).toBeTruthy();
    expect(view.getByRole("option").getAttribute("aria-disabled")).toBe("true");
    expect(view.getByRole("option").textContent).toContain("56% full");
    view.rerender(content("/co"));
    fireEvent.keyDown(view.getByRole("textbox"), { key: "ArrowDown" });
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    expect(compact).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(content("/unknown"));
    expect(view.getByText("No matching commands")).toBeTruthy();
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    expect(compact).toHaveBeenCalledTimes(1);
    view.rerender(content("/compact", true));
    fireEvent.click(view.getByRole("option"));
    fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
    expect(compact).toHaveBeenCalledTimes(1);
    view.rerender(content("Explain /compact"));
    expect(view.queryByRole("listbox")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await i18n.changeLanguage(language);
    await window.happyDOM.close();
  }
});

test.each(["click", "enter", "submit", "prefix", "trailing"])(
  "%s triggers the host compact command, preserves drafts on failure and never sends a model prompt",
  async (mode) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    const requests = useRequests.getState();
    const sessions = useSessions.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup, act, waitFor } = await import(
      "@testing-library/react/pure"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/workspace" }]);
    client.setQueryData(["models"], [snapshot.model]);
    let pending = Promise.withResolvers<Response>();
    globalThis.fetch = vi.fn(() => pending.promise);
    try {
      useWorkspace.setState({
        drafts: {
          test: mode === "prefix" ? "/co" : mode === "trailing" ? "/compact " : "/compact",
        },
        images: {},
        files: { test: [{ name: "note.txt", text: "Keep" }] },
        skills: { test: [{ id: "a".repeat(24), name: "example" }] },
      });
      useRequests.setState({ pending: {}, delivery: {} });
      const view = render(
        <QueryClientProvider client={client}>
          <ChatComposer snapshot={snapshot} connected />
        </QueryClientProvider>,
      );
      const trigger = () => {
        if (mode === "click") fireEvent.click(view.getByRole("option"));
        else if (mode === "enter") fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
        else fireEvent.submit(view.container.querySelector("form")!);
      };
      trigger();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/sessions/test/compact",
        expect.objectContaining({ method: "POST" }),
      );
      expect(useRequests.getState().pending.test).toBeUndefined();
      expect(view.queryByText("Compacting context")).toBeNull();
      expect(view.getByRole("textbox").textContent).toBe("");
      expect(view.container.querySelector("form")?.getAttribute("data-running")).toBe("false");
      expect(view.getByRole("textbox").getAttribute("contenteditable")).toBe("false");
      fireEvent.submit(view.container.querySelector("form")!);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const abortRequest = vi.fn(async () => Response.json(snapshot));
      globalThis.fetch = abortRequest;
      await act(async () => fireEvent.click(view.getByRole("button", { name: "Stop generating" })));
      expect(abortRequest).toHaveBeenCalledWith(
        "/api/sessions/test/abort",
        expect.objectContaining({ method: "POST" }),
      );
      globalThis.fetch = vi.fn(() => pending.promise);
      await act(async () =>
        pending.resolve(
          Response.json(
            { code: "operation_failed", message: "Summary unavailable" },
            { status: 500 },
          ),
        ),
      );
      await waitFor(() =>
        expect(view.getByRole("alert").textContent).toContain("Summary unavailable"),
      );
      expect(useWorkspace.getState().drafts.test).toBe(
        mode === "prefix" ? "/co" : mode === "trailing" ? "/compact " : "/compact",
      );
      pending = Promise.withResolvers<Response>();
      trigger();
      await act(async () => pending.resolve(Response.json(snapshot)));
      await waitFor(() => expect(useWorkspace.getState().drafts.test).toBe(""));
      expect(useWorkspace.getState().files.test).toHaveLength(1);
      expect(useWorkspace.getState().skills.test).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      useSessions.setState(sessions, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
