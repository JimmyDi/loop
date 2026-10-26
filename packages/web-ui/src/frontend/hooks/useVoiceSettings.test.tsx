import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";

import type { VoiceInstallCommand, VoiceStatus } from "../../shared/voice";

const voiceStatus = (installed = false): VoiceStatus => ({
  supported: true,
  installed,
  ttsInstalled: installed,
  engineAvailable: true,
  localManagement: true,
  phase: "idle",
});

const setup = async (initial = voiceStatus()) => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const post = Promise.withResolvers<Response>();
  const refresh = Promise.withResolvers<Response>();
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  let reads = 0;
  globalThis.fetch = vi.fn(async (url, init) => {
    const method = init?.method ?? "GET";
    requests.push({
      url: String(url),
      method,
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    });
    if (method === "POST") return post.promise;
    reads++;
    return reads === 1
      ? Response.json(initial)
      : refresh.promise.then((response) => response.clone());
  }) as typeof fetch;
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react/pure");
  const { useVoiceSettings } = await import("./useVoiceSettings");
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(useVoiceSettings, { wrapper });
  const close = async () => {
    cleanup();
    client.clear();
    post.resolve(Response.json(initial));
    refresh.resolve(Response.json(initial));
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  };
  return { ...hook, act, waitFor, client, post, refresh, requests, close };
};

test("mount only reads voice status without installing or changing resources", async () => {
  const fixture = await setup();
  try {
    await fixture.waitFor(() => expect(fixture.result.current.query.isSuccess).toBe(true));
    expect(fixture.requests).toEqual([{ url: "/api/voice/status", method: "GET" }]);
    expect(fixture.result.current.pending).toBe(false);
    expect(fixture.result.current.requested).toBeUndefined();
  } finally {
    await fixture.close();
  }
});

test.each(["install", "update", "uninstall"] as const)(
  "exposes the requested %s step while its POST is pending, then refreshes status",
  async (action) => {
    const fixture = await setup(voiceStatus(action !== "install"));
    try {
      await fixture.waitFor(() => expect(fixture.result.current.query.isSuccess).toBe(true));
      const command: VoiceInstallCommand = { action, profile: "conversation" };
      let operation: Promise<void> | undefined;
      fixture.act(() => {
        operation = fixture.result.current.execute(command);
      });
      expect(fixture.result.current.requested).toBe(action);
      expect(fixture.result.current.pending).toBe(true);
      expect(fixture.requests).toEqual([
        { url: "/api/voice/status", method: "GET" },
        { url: "/api/voice/install", method: "POST", body: command },
      ]);
      const accepted: VoiceStatus = {
        ...voiceStatus(action !== "install"),
        phase:
          action === "uninstall" ? "uninstalling" : action === "update" ? "updating" : "installing",
      };
      await fixture.act(async () => {
        fixture.post.resolve(Response.json(accepted, { status: 202 }));
        await operation;
      });
      expect(fixture.result.current.pending).toBe(false);
      expect(fixture.result.current.requested).toBeUndefined();
      expect(fixture.result.current.error).toBeUndefined();
      expect(fixture.client.getQueryData(["voice-status"])).toEqual(accepted);
      expect(fixture.result.current.query.data).toEqual(accepted);
      expect(fixture.requests.at(-1)).toEqual({ url: "/api/voice/status", method: "GET" });
      const completed = voiceStatus(action !== "uninstall");
      await fixture.act(async () => {
        fixture.refresh.resolve(Response.json(completed));
      });
      await fixture.waitFor(() => expect(fixture.result.current.query.data).toEqual(completed));
      expect(fixture.client.getQueryData(["voice-status"])).toEqual(completed);
      expect(fixture.requests.filter((request) => request.method !== "GET")).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  },
);

test("failed commands clear the requested step, retain the error, and refresh resource status", async () => {
  const initial = voiceStatus();
  const fixture = await setup(initial);
  try {
    await fixture.waitFor(() => expect(fixture.result.current.query.isSuccess).toBe(true));
    let operation: Promise<void> | undefined;
    fixture.act(() => {
      operation = fixture.result.current.execute({ action: "install", profile: "input" });
    });
    expect(fixture.result.current.requested).toBe("install");
    expect(fixture.result.current.pending).toBe(true);
    await fixture.act(async () => {
      fixture.post.resolve(
        Response.json(
          { code: "voice_download_failed", message: "Synthetic download failed" },
          { status: 503 },
        ),
      );
      await operation;
    });
    expect(fixture.result.current.pending).toBe(false);
    expect(fixture.result.current.requested).toBeUndefined();
    expect(fixture.result.current.error).toMatchObject({
      code: "voice_download_failed",
      message: "Synthetic download failed",
      status: 503,
    });
    expect(fixture.result.current.query.data).toEqual(initial);
    expect(fixture.client.getQueryData(["voice-status"])).toEqual(initial);
    expect(fixture.requests).toEqual([
      { url: "/api/voice/status", method: "GET" },
      { url: "/api/voice/install", method: "POST", body: { action: "install", profile: "input" } },
      { url: "/api/voice/status", method: "GET" },
    ]);
    const refreshed: VoiceStatus = { ...initial, phase: "error", error: "voice_download_failed" };
    await fixture.act(async () => {
      fixture.refresh.resolve(Response.json(refreshed));
    });
    await fixture.waitFor(() => expect(fixture.result.current.query.data).toEqual(refreshed));
    expect(fixture.client.getQueryData(["voice-status"])).toEqual(refreshed);
    expect(fixture.result.current.error).toMatchObject({ code: "voice_download_failed" });
  } finally {
    await fixture.close();
  }
});

test("recovers an accepted background install and continues polling after its POST response is lost", async () => {
  const fixture = await setup();
  try {
    await fixture.waitFor(() => expect(fixture.result.current.query.isSuccess).toBe(true));
    vi.useFakeTimers();
    let operation: Promise<void> | undefined;
    fixture.act(() => {
      operation = fixture.result.current.execute({ action: "install", profile: "conversation" });
    });
    expect(fixture.result.current.requested).toBe("install");
    expect(fixture.result.current.pending).toBe(true);
    const networkError = new TypeError("Synthetic response connection lost");
    await fixture.act(async () => {
      fixture.post.reject(networkError);
      await operation;
    });
    expect(fixture.result.current.pending).toBe(false);
    expect(fixture.result.current.requested).toBeUndefined();
    expect(fixture.result.current.error).toBe(networkError);
    expect(fixture.requests.at(-1)).toEqual({ url: "/api/voice/status", method: "GET" });
    const installing: VoiceStatus = { ...voiceStatus(), phase: "installing" };
    await fixture.act(async () => {
      fixture.refresh.resolve(Response.json(installing));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fixture.result.current.query.data).toEqual(installing);
    expect(fixture.client.getQueryData(["voice-status"])).toEqual(installing);
    const readsBeforePolling = fixture.requests.filter(
      (request) => request.method === "GET",
    ).length;
    await fixture.act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(fixture.requests.filter((request) => request.method === "GET")).toHaveLength(
      readsBeforePolling + 1,
    );
    expect(fixture.result.current.query.data).toEqual(installing);
    expect(fixture.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  } finally {
    vi.useRealTimers();
    await fixture.close();
  }
});
