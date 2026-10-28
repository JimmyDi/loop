import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { SessionSnapshot } from "../../../shared/protocol";
import type { VoiceStatus } from "../../../shared/voice";
import { useVoiceComposer } from "../../hooks/useVoiceComposer";
import type { VoiceControl, VoiceOptions } from "../../hooks/voice-hook-types";
import { i18n } from "../../i18n/setup";
import { useVoiceSetupState } from "../../voice/setup-state";
import { VoiceCallButton } from "../chat/VoiceCallButton";
import { VoiceInputButton } from "../chat/VoiceInputButton";
import { VoiceSettings } from "./VoiceSettings";

const microphone = vi.hoisted(() => ({
  options: undefined as VoiceOptions | undefined,
  start: vi.fn(async () => {}),
}));

vi.mock("../../hooks/useVoice", () => ({
  useVoice: (options: VoiceOptions): VoiceControl => {
    if (!options.sessionId) microphone.options = options;
    return {
      status: "listening",
      text: "",
      muted: false,
      readingPaused: false,
      start: microphone.start,
      stop: async () => {},
      endInput: async () => {},
      speak: () => {},
      finish: () => {},
      interrupt: () => {},
      mute: () => {},
      pauseReading: () => {},
    };
  },
}));

const setup = useVoiceSetupState.getState();

beforeEach(() => {
  useVoiceSetupState.setState({
    profile: "conversation",
    deviceId: "",
    verifiedSignature: undefined,
  });
  microphone.options = undefined;
  microphone.start.mockClear();
});

afterEach(() => useVoiceSetupState.setState(setup, true));

test("remote settings describe local management and disable installation", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: false,
    phase: "idle",
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain("computer running Loop");
  expect(html).toContain("Recordings are not saved");
  expect(html).toContain("Phone audio travels through");
  for (const name of ["Download"])
    expect(html).toMatch(new RegExp('<button[^>]*aria-label="' + name + '"[^>]*disabled=""'));
  client.clear();
});

test("remote input-only installation can choose voice input and test the microphone", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: true,
    ttsInstalled: false,
    localManagement: false,
    engineAvailable: true,
    phase: "idle",
  });
  const { render, cleanup, fireEvent } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <VoiceSettings />
      </QueryClientProvider>,
    );
    const profile = view.getByRole("button", {
      name: i18n.t("voice.chooseProfile"),
    }) as HTMLButtonElement;
    expect(profile.disabled).toBe(false);
    expect(
      (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(profile);
    fireEvent.click(view.getByRole("menuitemradio", { name: i18n.t("voice.inputProfile") }));
    expect(profile.textContent).toContain(i18n.t("voice.inputProfile"));
    expect(
      (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (view.getByRole("button", { name: i18n.t("voice.preview") }) as HTMLButtonElement).disabled,
    ).toBe(true);
    for (const name of ["install"])
      expect(
        (view.getByRole("button", { name: i18n.t("voice." + name) }) as HTMLButtonElement).disabled,
      ).toBe(true);
    expect(view.getAllByRole("listitem")).toHaveLength(3);
    expect(view.getByRole("alert").closest("li")).toBe(view.getAllByRole("listitem")[1]);
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("installed resources unlock composer controls independently of optional microphone tests", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  const status: VoiceStatus = {
    supported: true,
    installed: true,
    ttsInstalled: true,
    engineAvailable: true,
    localManagement: true,
    phase: "idle",
    version: "1",
    components: (["engine", "asr", "vad", "tts"] as const).map((kind) => ({
      id: kind,
      name: kind,
      kind,
      installed: true,
      downloadBytes: 1,
      installedBytes: 1,
      license: "MIT",
      version: "1",
    })),
  };
  client.setQueryData(["voice-status"], status);
  const snapshot = {
    sessionId: "setup-session",
    streamId: "stream",
    operation: "idle",
    tools: {},
    state: { messages: [], hasPendingSave: false },
  } as unknown as SessionSnapshot;
  const ComposerControls = () => {
    const control = useVoiceComposer(snapshot, true, true);
    return (
      <>
        <VoiceInputButton control={control} />
        <VoiceCallButton control={control} />
      </>
    );
  };
  const content = (open: boolean) => (
    <QueryClientProvider client={client}>
      {open && <VoiceSettings />}
      <ComposerControls />
    </QueryClientProvider>
  );
  const { render, cleanup, fireEvent, act, waitFor } = await import("@testing-library/react/pure");
  try {
    const view = render(content(true));
    const expectBlocked = (disabled: boolean) => {
      const currentInput = view.getByRole("button", {
        name: i18n.t("voice.dictation"),
      }) as HTMLButtonElement;
      const currentCall = view.getByRole("button", { name: "Call" }) as HTMLButtonElement;
      expect(currentInput.disabled).toBe(disabled);
      expect(currentCall.disabled).toBe(disabled);
      expect(currentCall.closest(".voice-setup-hint")?.getAttribute("title")).toBe(
        disabled ? i18n.t("voice.setupRequired") : undefined,
      );
    };
    const transcript = async (text: string, final: boolean) =>
      act(async () => {
        microphone.options?.transcript(text, final, "test", "test");
      });
    const finishTest = async () => {
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
      await transcript("Microphone works", true);
      await act(async () =>
        fireEvent.click(view.getByRole("button", { name: i18n.t("voice.stopTest") })),
      );
      expectBlocked(false);
    };
    expectBlocked(false);
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.microphone") }));
    expect(microphone.start).toHaveBeenCalledExactlyOnceWith("test");
    await transcript("Partial phrase", false);
    expectBlocked(false);
    await transcript("  ", true);
    expectBlocked(false);
    await transcript("Microphone works", true);
    expectBlocked(false);
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: i18n.t("voice.stopTest") })),
    );
    expectBlocked(false);
    expect(view.getAllByRole("listitem")[2]?.getAttribute("data-complete")).toBe("true");

    view.rerender(content(false));
    view.rerender(content(true));
    expectBlocked(false);
    expect(view.getAllByRole("listitem")[2]?.getAttribute("data-complete")).toBe("true");
    fireEvent.click(view.getByRole("button", { name: i18n.t("voice.chooseProfile") }));
    fireEvent.click(view.getByRole("menuitemradio", { name: i18n.t("voice.inputProfile") }));
    expectBlocked(false);
    await finishTest();
    act(() => useVoiceSetupState.getState().setDevice("other-microphone"));
    expectBlocked(false);
    await finishTest();
    act(() => client.setQueryData(["voice-status"], { ...status, phase: "updating" }));
    await waitFor(() => expectBlocked(true));
    act(() => client.setQueryData(["voice-status"], status));
    await waitFor(() => {
      expect(
        (view.getByRole("button", { name: i18n.t("voice.microphone") }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
    expectBlocked(false);
    await finishTest();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("installed components show uninstall instead of download", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: true,
    ttsInstalled: true,
    localManagement: true,
    engineAvailable: true,
    updateAvailable: false,
    phase: "idle",
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  const repair = html.match(/<button[^>]*aria-label="Uninstall"[^>]*>/)?.[0];
  expect(repair).toBeDefined();
  expect(repair).not.toContain("disabled");
  expect(html).not.toContain('aria-label="Download"');
  client.clear();
});

test("unpublished engines show a specific reason and disable download without microphone errors", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: true,
    engineAvailable: false,
    phase: "error",
    error: "voice_engine_unavailable",
    components: [
      {
        id: "engine",
        kind: "engine",
        name: "Local engine",
        version: "1",
        installed: false,
        downloadBytes: 0,
        requiredBytes: 0,
        installedBytes: 0,
        license: "MIT",
      },
    ],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain("has not been published");
  expect(html).not.toContain("Check microphone permission");
  expect(html).toContain("Component sizes, licenses and storage");
  expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  client.clear();
});

test("uninstalled models expose package details through their own info icon", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["voice-status"], {
    supported: true,
    installed: false,
    localManagement: true,
    phase: "idle",
    components: [
      {
        id: "asr",
        name: "Recognition model",
        kind: "asr",
        version: "1",
        installed: false,
        downloadBytes: 1048576,
        requiredBytes: 3145728,
        installedBytes: 0,
        license: "MIT",
      },
    ],
  });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <VoiceSettings />
    </QueryClientProvider>,
  );
  expect(html).toContain('aria-label="Recognition model: Component sizes, licenses and storage"');
  expect(html).not.toContain('role="tooltip"');
  client.clear();
});

test("partial installation downloads respect engine availability and management gates", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const status = {
    supported: true,
    installed: false,
    localManagement: true,
    engineAvailable: false,
    phase: "error",
    error: "voice_resource_integrity_failed",
    components: [
      {
        id: "asr-cache",
        name: "Cached recognition model",
        kind: "asr",
        version: "1",
        installed: true,
        downloadBytes: 10,
        installedBytes: 10,
        license: "MIT",
      },
    ],
  };
  const uninstall = (value: typeof status) => {
    client.setQueryData(["voice-status"], value);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <VoiceSettings />
      </QueryClientProvider>,
    );
    return html.match(/<button[^>]*aria-label="Download"[^>]*>/)?.[0];
  };
  expect(uninstall(status)).toBeDefined();
  expect(uninstall(status)).toContain("disabled");
  expect(uninstall({ ...status, localManagement: false })).toContain("disabled");
  expect(uninstall({ ...status, supported: false })).toContain("disabled");
  expect(uninstall({ ...status, phase: "installing" })).toContain("disabled");
  client.clear();
});
