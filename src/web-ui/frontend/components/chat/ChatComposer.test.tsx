import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { ChatComposer } from "./ChatComposer";

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

test("ChatComposer renders the session state without unsupported controls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ChatComposer snapshot={snapshot} connected={true} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Stop generating");
  expect(html).toContain('aria-disabled="true"');
  client.clear();
});

test("composer owns model controls, blocks send while switching and preserves drafts", async () => {
  const { Window } = await import("happy-dom");
  const { i18n } = await import("../../i18n/setup");
  const { useWorkspace } = await import("../../state/workspace-store");
  const { SessionHeader } = await import("../layout/SessionHeader");
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup, within } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const current: SessionSnapshot = {
    ...snapshot,
    operation: "idle",
    model: { ...snapshot.model, efforts: ["default", "low", "high"] },
    effort: "low",
  };
  client.setQueryData(["projects"], []);
  client.setQueryData(["models"], [current.model]);
  let finish!: (response: Response) => void;
  const requests: string[] = [];
  globalThis.fetch = (async (url) => {
    requests.push(String(url));
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  }) as typeof fetch;
  try {
    await i18n.changeLanguage("en");
    useWorkspace.setState({ drafts: { test: "Keep this draft" } });
    const view = render(
      <QueryClientProvider client={client}>
        <SessionHeader snapshot={current} />
        <ChatComposer snapshot={current} connected />
      </QueryClientProvider>,
    );
    expect(within(view.getByRole("banner")).queryByRole("combobox")).toBeNull();
    expect(
      within(view.getByRole("banner")).queryByRole("button", { name: /Model settings/ }),
    ).toBeNull();
    fireEvent.click(view.getByRole("button", { name: /Model settings: Test/ }));
    fireEvent.click(view.getByRole("menuitem", { name: /Effort Low/ }));
    fireEvent.click(view.getByRole("menuitemradio", { name: "High" }));
    expect((view.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.submit(view.container.querySelector("form")!);
    expect(requests).toEqual(["/api/sessions/test/model"]);
    await act(async () => finish(Response.json({ ...current, effort: "high" })));
    expect(useWorkspace.getState().drafts.test).toBe("Keep this draft");
    expect(view.queryByRole("menu")).toBeNull();
    expect((view.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    act(() => {
      useWorkspace.getState().draft("test", "");
      useWorkspace
        .getState()
        .attach("test", [{ type: "image", mimeType: "image/png", data: "AAAA" }]);
    });
    expect((view.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(view.getByRole("img", { name: "Image attachment 1" })).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
