import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { expect, test } from "vitest";

import type { VoiceStatus } from "../../shared/voice";
import { useVoiceSetupState } from "../voice/setup-state";
import { useVoiceSetup } from "./useVoiceSetup";

test("only verified current setup enables voice and resource changes invalidate the test", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const saved = useVoiceSetupState.getState();
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false, gcTime: Infinity } },
  });
  const status: VoiceStatus = {
    supported: true,
    installed: true,
    ttsInstalled: true,
    engineAvailable: true,
    version: "synthetic-1",
    localManagement: true,
    phase: "idle",
    components: (["engine", "asr", "vad", "tts"] as const).map((kind) => ({
      id: kind,
      kind,
      name: kind,
      version: "1",
      installed: true,
      downloadBytes: 1,
      installedBytes: 1,
      license: "MIT",
    })),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { renderHook, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  try {
    useVoiceSetupState.setState({
      profile: "conversation",
      deviceId: "",
      verifiedSignature: undefined,
    });
    const hook = renderHook(useVoiceSetup, { wrapper });
    expect(hook.result.current.complete).toBe(false);
    expect(hook.result.current.ready).toBe(false);
    act(() => hook.result.current.verify());
    expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
    await act(async () => client.setQueryData(["voice-status"], status));
    await waitFor(() => expect(hook.result.current.signature).toBeDefined());
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.complete).toBe(false);
    act(() => hook.result.current.verify());
    expect(hook.result.current.complete).toBe(true);
    hook.unmount();
    const reopened = renderHook(useVoiceSetup, { wrapper });
    expect(reopened.result.current.complete).toBe(true);
    act(() => reopened.result.current.setDevice("different-microphone"));
    expect(reopened.result.current.complete).toBe(false);
    expect(reopened.result.current.ready).toBe(true);
    act(() => reopened.result.current.verify());
    expect(reopened.result.current.complete).toBe(true);
    await act(async () => client.setQueryData(["voice-status"], { ...status, phase: "updating" }));
    await waitFor(() => expect(reopened.result.current.complete).toBe(false));
    expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
    await act(async () => client.setQueryData(["voice-status"], status));
    await waitFor(() => expect(reopened.result.current.signature).toBeDefined());
    expect(reopened.result.current.complete).toBe(false);
    act(() => reopened.result.current.verify());
    await act(async () =>
      client.setQueryData(["voice-status"], { ...status, version: "synthetic-2" }),
    );
    await waitFor(() => expect(reopened.result.current.complete).toBe(false));
    expect(useVoiceSetupState.getState().verifiedSignature).toBeUndefined();
    act(() => reopened.result.current.verify());
    expect(reopened.result.current.complete).toBe(true);
    act(() => reopened.result.current.setProfile("input"));
    expect(reopened.result.current.complete).toBe(false);
  } finally {
    cleanup();
    client.clear();
    useVoiceSetupState.setState(saved, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
