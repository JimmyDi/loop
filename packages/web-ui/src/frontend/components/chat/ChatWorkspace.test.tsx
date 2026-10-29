import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { useSessions } from "../../state/session-store";
import { useWorkspace } from "../../state/workspace-store";
import { useRequests } from "../../state/request-store";
import { useQueueEdits } from "../../state/queue-edit-store";
import { ChatWorkspace } from "./ChatWorkspace";
import { useVoiceSetupState } from "../../voice/setup-state";
import { voiceSetupSignature } from "../../voice/setup-readiness";
import type { VoiceStatus } from "../../../shared/voice";

test("ChatWorkspace exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ChatWorkspace id="example" />
    </QueryClientProvider>,
  );

  expect(html).toContain("Loading");
  expect(html).toContain("session-header");
  expect(html).not.toContain("<nav");
  client.clear();
});

test("composer voice actions follow connection and session changes without header controls", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
    fetch: globalThis.fetch,
  };
  const workspace = useWorkspace.getState();
  const sessions = useSessions.getState();
  const requests = useRequests.getState();
  const edits = useQueueEdits.getState();
  const setup = useVoiceSetupState.getState();
  const connections: LocalSource[] = [];
  class LocalSource {
    onmessage?: (event: { data: string }) => void;
    onerror?: () => void;
    closed = false;
    constructor(readonly url: string) {
      connections.push(this);
    }
    close() {
      this.closed = true;
    }
  }
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  const { render, act, waitFor, cleanup, within } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const snapshots: SessionSnapshot[] = ["first", "second"].map((id) => ({
    sessionId: id,
    workspaceId: "project",
    streamId: "stream-" + id,
    operation: "idle",
    tools: {},
    model: { provider: "example", id: "example", name: "Example" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
      permissionPreset: "read-only",
      title: { text: id + " conversation", source: "user", messageIndices: [] },
    },
  }));
  for (const snapshot of snapshots) client.setQueryData(["session", snapshot.sessionId], snapshot);
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
  client.setQueryData(["models"], [snapshots[0]!.model]);
  const voiceStatus: VoiceStatus = {
    supported: true,
    installed: true,
    ttsInstalled: true,
    localManagement: true,
    phase: "idle",
    version: "synthetic-1",
    components: (["engine", "asr", "vad", "tts"] as const).map((kind) => ({
      id: kind,
      name: kind,
      kind,
      version: "1",
      installed: true,
      downloadBytes: 1,
      installedBytes: 1,
      license: "MIT",
    })),
  };
  client.setQueryData(["voice-status"], voiceStatus);
  useVoiceSetupState.setState({
    profile: "conversation",
    deviceId: "",
    verifiedSignature: voiceSetupSignature(voiceStatus, "conversation", ""),
  });
  const fetched: string[] = [];
  globalThis.fetch = (async (input) => {
    fetched.push(String(input));
    return Response.json([]);
  }) as typeof fetch;
  const page = (id: string) => (
    <QueryClientProvider client={client}>
      <ChatWorkspace id={id} />
    </QueryClientProvider>
  );

  try {
    useWorkspace.setState({
      active: { id: "first", workspaceId: "project" },
      drafts: {},
      images: {},
      files: {},
      skills: {},
    });
    useRequests.setState({ pending: {} });
    useQueueEdits.setState({ edits: {} });
    useSessions.setState({
      views: Object.fromEntries(
        snapshots.map((snapshot) => [snapshot.sessionId, { snapshot, connected: true }]),
      ),
    });
    const ui = render(page("first"));
    const header = ui.container.querySelector<HTMLElement>(".session-header")!;
    const composer = () => ui.container.querySelector<HTMLElement>(".chat-composer")!;
    await waitFor(() =>
      expect(within(composer()).getByRole("button", { name: "Call" })).toBeTruthy(),
    );
    const firstCall = within(composer()).getByRole("button", { name: "Call" }) as HTMLButtonElement;
    const firstInput = within(composer()).getByRole("button", { name: "Voice input" });
    const submitActions = composer().querySelector<HTMLElement>(".composer-submit-actions")!;
    expect(firstCall.disabled).toBe(false);
    expect(submitActions).toBeTruthy();
    expect(within(submitActions).getAllByRole("button")).toEqual([
      firstInput,
      firstCall,
      within(composer()).getByRole("button", { name: "Send message" }),
    ]);
    expect(within(header).queryByRole("button", { name: "Call" })).toBeNull();
    expect(within(header).queryByRole("button", { name: "Voice input" })).toBeNull();
    expect(composer().querySelector(".composer-input-row .voice-input-button")).toBeNull();
    expect(ui.getAllByRole("button", { name: "Call" })).toHaveLength(1);

    const firstSource = connections.find((source) => source.url.includes("/first/events"))!;
    expect(firstSource).toBeTruthy();
    act(() => firstSource.onerror?.());
    await waitFor(() => expect(firstCall.disabled).toBe(true));
    expect(within(composer()).getByRole("button", { name: "Call" })).toBe(firstCall);

    act(() => useWorkspace.getState().open({ id: "second", workspaceId: "project" }));
    ui.rerender(page("second"));
    await waitFor(() => {
      expect(within(header).getByRole("button", { name: "second conversation" })).toBeTruthy();
      expect(ui.getAllByRole("button", { name: "Call" })).toHaveLength(1);
    });
    const secondCall = within(composer()).getByRole("button", {
      name: "Call",
    }) as HTMLButtonElement;
    expect(secondCall).not.toBe(firstCall);
    expect(secondCall.disabled).toBe(false);
    expect(composer().querySelector(".composer-submit-actions")?.contains(secondCall)).toBe(true);
    expect(firstCall.isConnected).toBe(false);
    expect(firstSource.closed).toBe(true);
    expect(connections.some((source) => source.url.includes("/second/events"))).toBe(true);
    expect(within(header).queryByRole("button", { name: "Call" })).toBeNull();
    expect(within(composer()).getByRole("button", { name: "Voice input" })).toBeTruthy();
    expect(fetched).toEqual([]);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useSessions.setState(sessions, true);
    useRequests.setState(requests, true);
    useQueueEdits.setState(edits, true);
    useVoiceSetupState.setState(setup, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each([
  { status: 404, code: "session_not_found", switchAway: false, cleared: true },
  { status: 500, code: "operation_failed", switchAway: false, cleared: false },
  { status: 404, code: "session_not_found", switchAway: true, cleared: false },
])(
  "failed session restore reconciles only missing active selections: %j",
  async ({ status, code, switchAway, cleared }) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, act, waitFor, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolve!: (value: Response) => void;
    globalThis.fetch = (() =>
      new Promise<Response>((done) => {
        resolve = done;
      })) as typeof fetch;
    try {
      useWorkspace.setState({
        active: { id: "missing", workspaceId: "project" },
        drafts: { missing: "Unsent draft" },
        images: { missing: [{ type: "image", data: "aA==", mimeType: "image/png" }] },
        files: { missing: [{ name: "example.txt", text: "Unsent attachment" }] },
      });
      const saved = useWorkspace.getState();
      const ui = render(
        <QueryClientProvider client={client}>
          <ChatWorkspace id="missing" />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(resolve).toBeTypeOf("function"));
      if (switchAway)
        act(() => useWorkspace.getState().open({ id: "other", workspaceId: "project" }));
      await act(async () =>
        resolve(Response.json({ code, message: "Example failure" }, { status })),
      );
      await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
      await waitFor(() =>
        expect(useWorkspace.getState().active?.id).toBe(
          cleared ? undefined : switchAway ? "other" : "missing",
        ),
      );
      expect(useWorkspace.getState().drafts).toEqual(saved.drafts);
      expect(useWorkspace.getState().images).toEqual(saved.images);
      expect(useWorkspace.getState().files).toEqual(saved.files);
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("home creates an independent draft and keeps the composer mounted through its first message", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    EventSource: globalThis.EventSource,
  };
  const workspace = useWorkspace.getState();
  const sessions = useSessions.getState();
  class LocalSource {
    close() {}
  }
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  const { render, act, waitFor, cleanup, fireEvent } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const snapshot: SessionSnapshot = {
    sessionId: "independent",
    workspaceId: null,
    streamId: "stream",
    operation: "idle",
    tools: {},
    model: { provider: "example", id: "example", name: "Example" },
    state: {
      messages: [],
      isRunning: false,
      hasPendingSave: false,
      outcome: "idle",
      listenerErrors: [],
    },
  };
  const writes: unknown[] = [];
  globalThis.fetch = (async (url, init) => {
    if (String(url) === "/api/sessions") {
      writes.push(JSON.parse(String(init?.body)));
      return Response.json(snapshot);
    }
    return Response.json([]);
  }) as typeof fetch;
  client.setQueryData(["models"], [snapshot.model]);
  client.setQueryData(["projects"], []);
  client.setQueryData(["voice-status"], { installed: false, components: [] });
  try {
    useWorkspace.setState({ active: undefined, drafts: {}, files: {}, images: {}, skills: {} });
    useSessions.setState({ views: {} });
    const ui = render(
      <QueryClientProvider client={client}>
        <ChatWorkspace />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ui.getByRole("textbox")).toBeTruthy());
    const input = ui.getByRole("textbox");
    expect(ui.getByText("Loop everything")).toBeTruthy();
    expect(writes).toEqual([{ workspaceId: null }]);
    expect(useWorkspace.getState().active).toEqual({ id: "independent", workspaceId: null });
    await act(async () =>
      ui.rerender(
        <QueryClientProvider client={client}>
          <ChatWorkspace id="independent" />
        </QueryClientProvider>,
      ),
    );
    expect(ui.getByRole("textbox")).toBe(input);
    await act(async () =>
      useSessions.setState({
        views: {
          independent: {
            connected: true,
            snapshot: {
              ...snapshot,
              state: {
                ...snapshot.state,
                messages: [{ role: "user", content: "Synthetic first message", timestamp: 1 }],
              },
            },
          },
        },
      }),
    );
    expect(ui.getByRole("textbox")).toBe(input);
    expect(ui.queryByText("Loop everything")).toBeNull();
    expect(ui.getByText("Synthetic first message")).toBeTruthy();
    fireEvent.focus(input);
    expect(ui.container.querySelector(".chat-workspace")).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useSessions.setState(sessions, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
