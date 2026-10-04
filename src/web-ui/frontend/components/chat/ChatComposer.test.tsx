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

test("new and switched composers focus drafts and restore focus after sending", async () => {
  const { Window } = await import("happy-dom");
  const { useWorkspace } = await import("../../state/workspace-store");
  const { useRequests } = await import("../../state/request-store");
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["models"], [snapshot.model]);
  let submitted = 0;
  globalThis.fetch = (async (_url) => {
    submitted++;
    return Response.json({}, { status: 202 });
  }) as typeof fetch;
  const composer = (current: SessionSnapshot, connected: boolean) => (
    <QueryClientProvider client={client}>
      <button type="button">Other control</button>
      <ChatComposer key={current.sessionId} snapshot={current} connected={connected} />
    </QueryClientProvider>
  );

  try {
    useWorkspace.setState({ drafts: { test: "Restored draft" }, images: {}, files: {} });
    useRequests.setState({ pending: {} });
    const fresh = { ...snapshot, sessionId: "new-session", operation: "idle" as const };
    const ui = render(composer(fresh, false));
    expect(document.activeElement).toBe(ui.getByRole("textbox"));
    ui.rerender(composer(fresh, true));
    expect(document.activeElement).toBe(ui.getByRole("textbox"));

    ui.getByRole("button", { name: "Other control" }).focus();
    const current = { ...snapshot, operation: "idle" as const };
    ui.rerender(composer(current, true));
    const input = ui.getByRole("textbox");
    expect(document.activeElement).toBe(input);
    expect(input.textContent).toBe("Restored draft");
    const selection = document.getSelection()!;
    expect(selection.isCollapsed).toBe(true);
    expect(selection.getRangeAt(0).endContainer).toBe(input);
    expect(selection.getRangeAt(0).endOffset).toBe(input.childNodes.length);

    const send = ui.getByRole("button", { name: "Send message" });
    send.focus();
    await act(async () => fireEvent.click(send));
    expect(submitted).toBe(1);
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("contenteditable")).toBe("false");

    const request = useRequests.getState().pending.test!;
    ui.rerender(composer({ ...snapshot, requestId: request.requestId }, true));
    expect(document.activeElement).toBe(input);
    const other = ui.getByRole("button", { name: "Other control" });
    other.focus();
    ui.rerender(
      composer(
        {
          ...current,
          requestId: request.requestId,
          state: { ...current.state, isRunning: false, outcome: "success" },
        },
        true,
      ),
    );
    expect(document.activeElement).toBe(other);
    act(() => useWorkspace.getState().draft("test", "Next message"));
    input.focus();
    await act(async () => fireEvent.keyDown(input, { key: "Enter", keyCode: 13 }));
    expect(submitted).toBe(2);
    expect(document.activeElement).toBe(input);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("attachment errors can be closed without losing drafts and reappear on the next failed upload", async () => {
  const { Window } = await import("happy-dom");
  const { useWorkspace } = await import("../../state/workspace-store");
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const workspace = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const current = { ...snapshot, operation: "idle" as const };
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["models"], [current.model]);
  const files = [{ name: "example.txt", text: "Keep attachment" }];
  const invalid = new File([new Uint8Array([0])], "binary.txt");
  try {
    useWorkspace.setState({ drafts: { test: "Keep draft" }, images: {}, files: { test: files } });
    const ui = render(
      <QueryClientProvider client={client}>
        <ChatComposer snapshot={current} connected />
      </QueryClientProvider>,
    );
    const input = ui.container.querySelector('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [invalid] } });
    });
    expect(ui.getByRole("alert").textContent).toContain("UTF-8");
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    expect(ui.queryByRole("alert")).toBeNull();
    act(() => useWorkspace.getState().draft("test", "Updated draft"));
    expect(ui.queryByRole("alert")).toBeNull();
    expect(useWorkspace.getState().files.test).toEqual(files);
    expect(useWorkspace.getState().drafts.test).toBe("Updated draft");
    await act(async () => {
      fireEvent.change(input, { target: { files: [invalid] } });
    });
    expect(ui.getByRole("alert").textContent).toContain("UTF-8");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
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
    act(() => {
      useWorkspace.getState().attach("test", []);
      useWorkspace.getState().attachFiles("test", [{ name: "example.txt", text: "Example" }]);
    });
    expect(view.getByTitle("example.txt").textContent).toBe("example.txt");
    expect((view.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
