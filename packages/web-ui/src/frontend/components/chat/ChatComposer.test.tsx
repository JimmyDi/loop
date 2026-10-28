import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { ChatComposer } from "./ChatComposer";
import type { VoiceComposerControl } from "../../hooks/voice-composer-types";

const recording = vi.hoisted(() => ({ control: undefined as VoiceComposerControl | undefined }));

vi.mock("../../hooks/useVoiceComposer", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../hooks/useVoiceComposer")>();
  return {
    useVoiceComposer: (...args: Parameters<typeof original.useVoiceComposer>) =>
      recording.control ?? original.useVoiceComposer(...args),
  };
});

test("dictation replaces toolbar controls and preserves the editable input", () => {
  const client = new QueryClient();
  recording.control = {
    voice: { status: "listening", mode: "dictation" },
    dictation: { active: true, finishing: false, samples: [] },
  } as unknown as VoiceComposerControl;
  try {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <ChatComposer snapshot={snapshot} connected />
      </QueryClientProvider>,
    );
    expect(html).toContain('role="textbox"');
    expect(html.indexOf('class="composer-toolbar"')).toBeLessThan(
      html.indexOf('class="composer-voice-input"'),
    );
    expect(html).toContain('class="composer-submit-actions"');
    expect(html).toContain("composer-voice-orb");
    expect(html).not.toContain("permission-trigger");
    expect(html).not.toContain("composer-model-trigger");
    expect(html).not.toContain("composer-add-trigger");
    expect(html).toContain("voice-input-sampler");
  } finally {
    recording.control = undefined;
    client.clear();
  }
});

vi.mock("../../hooks/useVoiceSetup", () => ({
  useVoiceSetup: () => ({ complete: true, ready: true }),
}));

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
    permissionPreset: "read-only",
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
  expect(html).toContain('contentEditable="true"');
  expect(html.indexOf('class="composer-toolbar"')).toBeLessThan(html.indexOf("permission-trigger"));
  expect(html).toContain("Session permissions: Read only");
  client.clear();
});

test.each([
  ["empty draft", "", "idle"],
  ["whitespace draft", " \t ", "idle"],
  ["newline draft", "\n\n", "idle"],
  ["nonbreaking space draft", "\u00a0", "idle"],
  ["hidden compact command", "/compact", "compact"],
] as const)(
  "dictation entry follows visible empty input with %s",
  async (_name, draft, operation) => {
    const { Window } = await import("happy-dom");
    const { useWorkspace } = await import("../../state/workspace-store");
    const { useRequests } = await import("../../state/request-store");
    const { useQueueEdits } = await import("../../state/queue-edit-store");
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    const workspace = useWorkspace.getState();
    const requests = useRequests.getState();
    const edits = useQueueEdits.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
    client.setQueryData(["models"], [snapshot.model]);
    const current: SessionSnapshot = {
      ...snapshot,
      operation,
      state: {
        ...snapshot.state,
        messages: [{ role: "user", content: "Synthetic task", timestamp: 0 }],
        isRunning: false,
      },
    };
    try {
      useWorkspace.setState({ drafts: { test: draft }, images: {}, files: {}, skills: {} });
      useRequests.setState({ pending: {}, delivery: {} });
      useQueueEdits.setState({ edits: {} });
      const ui = render(
        <QueryClientProvider client={client}>
          <ChatComposer snapshot={current} connected />
        </QueryClientProvider>,
      );
      const input = ui.getByRole("textbox");
      expect(input.textContent).toBe(operation === "compact" ? "" : draft);
      expect(useWorkspace.getState().drafts.test).toBe(draft);
      expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
      expect(ui.container.querySelector(".composer-input-action")).toBeNull();
      expect(ui.getByRole("button", { name: "Call" })).toBeTruthy();
      expect(ui.container.querySelector(".voice-controls")).toBeNull();

      input.textContent = "Synthetic draft";
      fireEvent.input(input);
      expect(useWorkspace.getState().drafts.test).toBe("Synthetic draft");
      expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
      expect(ui.container.querySelector(".composer-input-action")).toBeNull();
      expect(ui.getByRole("button", { name: "Call" })).toBeTruthy();

      input.textContent = "";
      fireEvent.input(input);
      expect(useWorkspace.getState().drafts.test).toBe("");
      expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
      expect(ui.container.querySelector(".composer-input-action")).toBeNull();

      for (const [value, stored] of [
        ["  ", "  "],
        ["\u00a0\u00a0", "  "],
      ] as const) {
        input.textContent = value;
        fireEvent.input(input);
        expect(useWorkspace.getState().drafts.test).toBe(stored);
        expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
        expect(ui.container.querySelector(".composer-input-action")).toBeNull();
        expect(ui.getByRole("button", { name: "Call" })).toBeTruthy();
      }

      for (const placeholder of ["<br>", "<div><br></div>"]) {
        input.textContent = "Synthetic draft";
        fireEvent.input(input);
        expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
        input.innerHTML = placeholder;
        fireEvent.input(input);
        expect(useWorkspace.getState().drafts.test!.trim()).toBe("");
        expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();
        expect(ui.container.querySelector(".composer-input-action")).toBeNull();
        expect(ui.getByRole("button", { name: "Call" })).toBeTruthy();
      }
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      useQueueEdits.setState(edits, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("composer keeps icon-only voice actions immediately before send through connection changes", async () => {
  const { Window } = await import("happy-dom");
  const { useWorkspace } = await import("../../state/workspace-store");
  const { useRequests } = await import("../../state/request-store");
  const { useQueueEdits } = await import("../../state/queue-edit-store");
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  const edits = useQueueEdits.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, within, cleanup, waitFor } = await import(
    "@testing-library/react/pure"
  );
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
  client.setQueryData(["models"], [snapshot.model]);
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: true,
    ttsInstalled: true,
    engineAvailable: true,
    phase: "idle",
    version: "test",
    localManagement: true,
    components: ["engine", "asr", "vad", "tts"].map((kind) => ({
      id: kind,
      kind,
      installed: true,
      version: "test",
      name: kind,
      license: "MIT",
      downloadBytes: 1,
      installedBytes: 1,
    })),
  });
  const current: SessionSnapshot = {
    ...snapshot,
    operation: "idle",
    state: {
      ...snapshot.state,
      messages: [{ role: "user", content: "Synthetic task", timestamp: 0 }],
      isRunning: false,
    },
  };
  const composer = (connected: boolean) => (
    <QueryClientProvider client={client}>
      <ChatComposer snapshot={current} connected={connected} />
    </QueryClientProvider>
  );
  try {
    useWorkspace.setState({ drafts: {}, images: {}, files: {}, skills: {} });
    useRequests.setState({ pending: {}, delivery: {} });
    useQueueEdits.setState({ edits: {} });
    const ui = render(composer(true));
    const actions = ui.container.querySelector<HTMLElement>(".composer-submit-actions")!;
    const call = within(actions).getByRole("button", { name: "Call" }) as HTMLButtonElement;
    await waitFor(() => expect(call.disabled).toBe(false));
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Voice input", "Call", "Send message"]);
    expect(call.textContent).toBe("");
    expect(ui.container.querySelector(".composer-input-area button")).toBeNull();
    expect(ui.container.querySelector(".voice-controls")).toBeNull();
    expect(ui.getByRole("button", { name: "Voice input" })).toBeTruthy();

    const input = ui.getByRole("textbox");
    input.textContent = "Synthetic draft";
    fireEvent.input(input);
    expect(useWorkspace.getState().drafts.test).toBe("Synthetic draft");
    expect(within(ui.container).getByRole("button", { name: "Voice input" })).toBeTruthy();
    expect(within(actions).getByRole("button", { name: "Call" })).toBe(call);
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Voice input", "Call", "Send message"]);
    await waitFor(() => expect(call.disabled).toBe(false));

    ui.rerender(composer(false));
    expect(call.disabled).toBe(true);
    ui.rerender(composer(true));
    await waitFor(() => expect(call.disabled).toBe(false));
    ui.unmount();
    expect(call.isConnected).toBe(false);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    useQueueEdits.setState(edits, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["running", "paused", "idle"])(
  "queue Edit shows only Send while %s and restores the previous draft after saving",
  async (mode) => {
    const { Window } = await import("happy-dom");
    const { useWorkspace } = await import("../../state/workspace-store");
    const { useRequests } = await import("../../state/request-store");
    const { useQueueEdits } = await import("../../state/queue-edit-store");
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    const requests = useRequests.getState();
    const edits = useQueueEdits.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(["models"], [snapshot.model]);
    const item = {
      id: "a",
      content: "Complete queued text\nNext line",
      skills: [],
      steering: false,
    };
    const current: SessionSnapshot = {
      ...snapshot,
      operation: mode === "running" ? "prompt" : "idle",
      state: {
        ...snapshot.state,
        messages: [{ role: "user", content: "Work", timestamp: 0 }],
        isRunning: mode === "running",
        canResume: mode === "paused",
        queue: [item, { ...item, id: "b", content: "Later" }],
      },
    };
    const writes: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (url, init) => {
      const body = JSON.parse(String(init?.body));
      writes.push({ url: String(url), body });
      return Response.json(
        body.action === "begin-edit" ? { item: { ...item, editing: true } } : { accepted: true },
      );
    }) as typeof fetch;
    try {
      useQueueEdits.setState({ edits: {} });
      useRequests.setState({ pending: {}, delivery: {} });
      useWorkspace.setState({
        drafts: { test: "Previous draft" },
        images: {},
        files: {},
        skills: {},
      });
      const ui = render(
        <QueryClientProvider client={client}>
          <ChatComposer snapshot={current} connected />
        </QueryClientProvider>,
      );
      fireEvent.click(ui.getAllByRole("button", { name: "More message options" })[0]!);
      await act(async () => fireEvent.click(ui.getByRole("menuitem", { name: "Edit" })));
      expect(ui.getAllByRole("textbox")).toHaveLength(1);
      expect(ui.getByRole("textbox").textContent).toBe(item.content);
      expect(document.activeElement).toBe(ui.getByRole("textbox"));
      expect(ui.getAllByRole("listitem")).toHaveLength(1);
      expect(ui.getByRole("listitem").textContent).toContain("Later");
      expect(ui.queryByRole("button", { name: "Resume" })).toBeNull();
      expect(ui.queryByRole("button", { name: "Stop generating" })).toBeNull();
      expect(ui.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(ui.queryByText("Editing queued message")).toBeNull();
      expect(ui.container.querySelectorAll(".composer-send")).toHaveLength(1);
      expect(ui.container.querySelector("form")?.getAttribute("data-running")).toBe("false");
      expect(ui.container.querySelector("form")?.getAttribute("data-editing")).toBe("true");
      const send = () => ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
      expect(send().disabled).toBe(false);
      act(() => useWorkspace.getState().draft("test", ""));
      expect(send().disabled).toBe(true);
      expect(ui.container.querySelectorAll(".composer-send")).toHaveLength(1);
      fireEvent.click(send());
      expect(writes).toHaveLength(1);
      act(() => useWorkspace.getState().draft("test", "/compact"));
      await act(async () => fireEvent.click(ui.getByRole("button", { name: "Send message" })));
      expect(writes).toEqual([
        { url: "/api/sessions/test/queue", body: { id: "a", action: "begin-edit" } },
        {
          url: "/api/sessions/test/queue",
          body: { id: "a", action: "edit", text: "/compact", images: [], files: [], skills: [] },
        },
      ]);
      expect(ui.getByRole("textbox").textContent).toBe("Previous draft");
      expect(ui.getAllByRole("listitem")).toHaveLength(2);
      const restoredControl = mode === "paused" ? "Resume" : "Send message";
      expect(ui.getByRole("button", { name: restoredControl })).toBeTruthy();
      expect(ui.container.querySelector("form")?.getAttribute("data-editing")).toBe("false");
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      useQueueEdits.setState(edits, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test("queued follow-up drafts show only Send until cleared or accepted", async () => {
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
  const current: SessionSnapshot = {
    ...snapshot,
    state: {
      ...snapshot.state,
      messages: [{ role: "user", content: "Work", timestamp: 0 }],
      queue: [{ id: "queued", content: "Later", skills: [], steering: false }],
    },
  };
  const accepted = Promise.withResolvers<Response>();
  const writes: string[] = [];
  globalThis.fetch = (async (url) => {
    writes.push(String(url));
    return accepted.promise;
  }) as typeof fetch;
  const composer = (value: SessionSnapshot) => (
    <QueryClientProvider client={client}>
      <ChatComposer snapshot={value} connected />
    </QueryClientProvider>
  );
  try {
    useWorkspace.setState({ drafts: {}, images: {}, files: {}, skills: {} });
    useRequests.setState({ pending: {}, delivery: {} });
    const ui = render(composer(current));
    expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    act(() => useWorkspace.getState().draft("test", "Next input"));
    expect(ui.queryByRole("button", { name: "Stop generating" })).toBeNull();
    expect(ui.container.querySelectorAll(".composer-send")).toHaveLength(1);
    ui.rerender(composer({ ...current, state: { ...current.state, queue: [] } }));
    expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    ui.rerender(composer(current));
    act(() => useWorkspace.getState().draft("test", "  "));
    expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    act(() =>
      useWorkspace.getState().attachFiles("test", [{ name: "fixture.txt", text: "Reference" }]),
    );
    expect(ui.queryByRole("button", { name: "Stop generating" })).toBeNull();
    const send = () => ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
    await act(async () => fireEvent.click(send()));
    expect(send().disabled).toBe(true);
    expect(ui.queryByRole("button", { name: "Stop generating" })).toBeNull();
    expect(writes).toEqual(["/api/sessions/test/prompt"]);
    await act(async () => accepted.resolve(Response.json({ runId: "run" }, { status: 202 })));
    expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(ui.getByRole("textbox").textContent).toBe("");
    expect(useWorkspace.getState().files.test).toEqual([]);
    expect(ui.getByRole("listitem").textContent).toContain("Later");
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("Stop becomes a resume control that preserves queued items and drafts through failure and retry", async () => {
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
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
  client.setQueryData(["models"], [snapshot.model]);
  const response = Promise.withResolvers<Response>();
  const writes: string[] = [];
  globalThis.fetch = (async (url) => {
    writes.push(String(url));
    if (writes.length === 2) return response.promise;
    return Response.json({ accepted: true }, { status: 202 });
  }) as typeof fetch;
  const queue = [{ id: "queued", content: "Later message", skills: [], steering: false }];
  const active = { ...snapshot, state: { ...snapshot.state, queue } };
  const paused: SessionSnapshot = {
    ...active,
    operation: "idle",
    state: { ...active.state, isRunning: false, outcome: "cancelled", canResume: true },
  };
  const composer = (current: SessionSnapshot, connected = true) => (
    <QueryClientProvider client={client}>
      <ChatComposer snapshot={current} connected={connected} />
    </QueryClientProvider>
  );
  try {
    useWorkspace.setState({ drafts: {}, images: {}, files: {}, skills: {} });
    useRequests.setState({ pending: {}, delivery: {} });
    const ui = render(composer(active));
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Stop generating" })));
    expect(writes).toEqual(["/api/sessions/test/abort"]);
    ui.rerender(composer(paused));
    const resume = () => ui.getByRole("button", { name: "Resume" }) as HTMLButtonElement;
    expect(resume().disabled).toBe(false);
    expect(resume().className).toContain("composer-send resume");
    expect(resume().querySelector("svg")).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Send message" })).toBeNull();
    expect(ui.getByText("Later message")).toBeTruthy();
    ui.rerender(composer(paused, false));
    expect(resume().disabled).toBe(true);
    ui.rerender(composer({ ...paused, state: { ...paused.state, hasPendingSave: true } }));
    expect(resume().disabled).toBe(true);
    ui.rerender(composer(paused));
    act(() => useWorkspace.getState().draft("test", "Next draft"));
    await act(async () => fireEvent.click(resume()));
    expect(resume().disabled).toBe(true);
    fireEvent.click(resume());
    expect(writes).toEqual(["/api/sessions/test/abort", "/api/sessions/test/resume"]);
    await act(async () =>
      response.resolve(
        Response.json({ code: "resume_unavailable", message: "Try again" }, { status: 409 }),
      ),
    );
    expect(resume().disabled).toBe(false);
    expect(ui.getByRole("alert").textContent).toContain("This conversation cannot resume yet.");
    await act(async () => fireEvent.click(resume()));
    expect(writes).toEqual([
      "/api/sessions/test/abort",
      "/api/sessions/test/resume",
      "/api/sessions/test/resume",
    ]);
    ui.rerender(composer(active));
    expect(ui.queryByRole("button", { name: "Stop generating" })).toBeNull();
    expect(ui.getByRole("button", { name: "Send message" })).toBeTruthy();
    expect(ui.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(ui.getByRole("textbox").textContent).toBe("Next draft");
    expect(ui.getByText("Later message")).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["success", "error", "cancelled"] as const)(
  "accepted prompts release the composer and preserve the next draft on %s",
  async (outcome) => {
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
    client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
    client.setQueryData(["models"], [snapshot.model]);
    const response = Promise.withResolvers<Response>();
    let submitted = 0;
    globalThis.fetch = (async () => {
      submitted++;
      return response.promise;
    }) as typeof fetch;
    const composer = (current: SessionSnapshot, key: string) => (
      <QueryClientProvider client={client}>
        <ChatComposer key={key} snapshot={current} connected />
      </QueryClientProvider>
    );

    try {
      useWorkspace.setState({
        drafts: { test: "Hello" },
        images: {},
        files: {},
        skills: { test: [{ id: "exact-review-source", name: "Review" }] },
      });
      useRequests.setState({ pending: {} });
      const current = {
        ...snapshot,
        operation: "idle" as const,
        state: { ...snapshot.state, isRunning: false },
      };
      const ui = render(composer(current, "initial"));
      expect(ui.getByText("Review").closest(".composer-skill-token")!.parentElement).toBe(
        ui.getByRole("textbox").parentElement,
      );
      expect(ui.getByRole("textbox").textContent).toBe("Hello");
      fireEvent.click(ui.getByRole("button", { name: "Send message" }));
      expect(useRequests.getState().pending.test).toMatchObject({
        text: "Hello",
        skills: ["exact-review-source"],
      });
      const expectWaiting = () => {
        expect(ui.getByText("Review").closest(".composer-skill-token")!).toBeTruthy();
        expect(ui.getByRole("textbox").textContent).toBe("Hello");
        expect(ui.queryByText(/Delivery could not be confirmed/)).toBeNull();
        expect(ui.queryByRole("button", { name: "Check and retry same request" })).toBeNull();
        expect(
          (ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(ui.getByRole("textbox").getAttribute("contenteditable")).toBe("true");
        fireEvent.submit(ui.container.querySelector("form")!);
        expect(submitted).toBe(1);
      };
      expectWaiting();
      ui.rerender(composer(current, "switched-during-send"));
      expectWaiting();
      const request = useRequests.getState().pending.test!;
      await act(async () => response.resolve(Response.json({ runId: "run" }, { status: 202 })));
      expect(useRequests.getState().pending.test).toBeUndefined();
      const accepted = {
        ...snapshot,
        requestId: request.requestId,
        state: {
          ...snapshot.state,
          messages: [{ role: "user" as const, content: "Hello", timestamp: 0 }],
        },
      };
      ui.rerender(composer(accepted, "accepted"));
      expect(ui.queryByText(/Delivery could not be confirmed/)).toBeNull();
      expect(ui.getByRole("button", { name: "Stop generating" })).toBeTruthy();
      expect(ui.queryByText("Review")).toBeNull();
      expect(ui.getByRole("textbox").textContent).toBe("");
      expect(ui.getByRole("textbox").getAttribute("data-empty")).toBe("true");
      expect(useWorkspace.getState().skills.test).toEqual([]);
      ui.rerender(composer(accepted, "switched-during-generation"));
      expect(ui.queryByText("Review")).toBeNull();
      expect(ui.getByRole("textbox").textContent).toBe("");
      act(() => useWorkspace.getState().draft("test", "New draft"));
      ui.rerender(
        composer(
          {
            ...current,
            requestId: request.requestId,
            state: { ...current.state, outcome },
          },
          "accepted",
        ),
      );
      expect(useRequests.getState().pending.test).toBeUndefined();
      expect(ui.queryByText("Review")).toBeNull();
      expect(ui.getByRole("textbox").textContent).toBe("New draft");
      act(() => useWorkspace.getState().draft("test", "Next message"));
      expect((ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

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
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
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
    expect(input.getAttribute("contenteditable")).toBe("true");

    const request = { requestId: "accepted" };
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
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
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
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
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

test("unselected project blocks button, form and Enter submission while retaining the draft", async () => {
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
  const { render, fireEvent, act, cleanup, waitFor } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["projects"], [{ id: "project", name: "Example", cwd: "/example" }]);
  client.setQueryData(["models"], [snapshot.model]);
  const writes: string[] = [];
  globalThis.fetch = (async (url) => {
    writes.push(String(url));
    return Response.json({ runId: "run" });
  }) as typeof fetch;
  try {
    useWorkspace.setState({
      drafts: { test: "Keep draft" },
      images: {},
      files: {},
      unselectedProjects: {},
    });
    useRequests.setState({ pending: {}, delivery: {} });
    const current = {
      ...snapshot,
      operation: "idle" as const,
      state: { ...snapshot.state, isRunning: false },
    };
    const ui = render(
      <QueryClientProvider client={client}>
        <ChatComposer snapshot={current} connected />
      </QueryClientProvider>,
    );
    expect((ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(ui.getByRole("button", { name: "Remove project Example" }));
    expect((ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.submit(ui.container.querySelector("form")!);
    fireEvent.keyDown(ui.getByRole("textbox"), { key: "Enter", keyCode: 13 });
    expect(writes).toEqual([]);
    expect(useWorkspace.getState().drafts.test).toBe("Keep draft");
    fireEvent.click(ui.getByRole("button", { name: "Choose project" }));
    await act(async () => fireEvent.click(ui.getByRole("menuitemradio", { name: "Example" })));
    await waitFor(() =>
      expect((ui.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    expect(writes).toEqual([]);
    await act(async () => fireEvent.click(ui.getByRole("button", { name: "Send message" })));
    expect(writes).toEqual(["/api/sessions/test/prompt"]);
  } finally {
    cleanup();
    client.clear();
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
