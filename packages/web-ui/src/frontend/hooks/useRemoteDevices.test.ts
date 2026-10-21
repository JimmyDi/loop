import { createElement } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { useRemoteDevices } from "./useRemoteDevices";

test("QR generation follows connection readiness, hides consumed invites and supports manual refresh", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let connectionId: string | undefined;
  let pending = false;
  let issued = 0;
  globalThis.fetch = vi.fn(async (url) => {
    if (url === "/api/remote-access/pairing") {
      issued++;
      return Response.json({
        url: "https://example.test/#pair=synthetic-" + issued,
        expiresAt: Date.now() + 300_000,
      });
    }
    return Response.json({
      connected: !!connectionId,
      connectionId,
      devices: [],
      pending: pending ? [{ id: "pending" }] : [],
    });
  }) as typeof fetch;
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  try {
    const view = renderHook(({ ready }) => useRemoteDevices(ready), {
      wrapper,
      initialProps: { ready: false },
    });
    await vi.waitFor(() => expect(view.result.current.query.isSuccess).toBe(true));
    expect(issued).toBe(0);
    connectionId = "first-connection";
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    expect(issued).toBe(0);
    view.rerender({ ready: true });
    await vi.waitFor(() => expect(view.result.current.qr).toMatch(/^data:image\/png/));
    expect(issued).toBe(1);
    expect(new URL(view.result.current.invite!.url).origin).toBe("https://example.test");
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    expect(issued).toBe(1);
    pending = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(view.result.current.invite).toBeUndefined());
    expect(issued).toBe(1);
    pending = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(issued).toBe(2));
    await vi.waitFor(() => expect(view.result.current.generating).toBe(false));
    expect(view.result.current.invite).toBeDefined();
    expect(issued).toBe(2);
    act(() => view.result.current.createInvite());
    await vi.waitFor(() => expect(view.result.current.qr).toMatch(/^data:image\/png/));
    expect(issued).toBe(3);
    connectionId = "second-connection";
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(issued).toBe(4));
    await vi.waitFor(() => expect(view.result.current.pending).toBe(false));
    view.rerender({ ready: false });
    expect(view.result.current.invite).toBeUndefined();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("expired QR codes renew automatically while connected and failures wait for manual retry", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let issued = 0;
  let pending = false;
  let fail = false;
  let expiredResponse = false;
  globalThis.fetch = vi.fn(async (url) => {
    if (url === "/api/remote-access/pairing") {
      issued++;
      return fail
        ? new Response(null, { status: 503 })
        : Response.json({
            url: "https://example.test/#pair=synthetic-" + issued,
            expiresAt: Date.now() + (expiredResponse ? -1 : 300_000),
          });
    }
    return Response.json({
      connected: true,
      connectionId: "synthetic-connection",
      devices: [],
      pending: pending ? [{ id: "pending" }] : [],
    });
  }) as typeof fetch;
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  try {
    const view = renderHook(({ ready }) => useRemoteDevices(ready), {
      wrapper,
      initialProps: { ready: true },
    });
    await vi.waitFor(() => expect(view.result.current.qr).toMatch(/^data:image\/png/));
    const first = view.result.current.invite!;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(first.expiresAt - Date.now() - 1);
    });
    expect(issued).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await vi.waitFor(() => expect(view.result.current.invite?.url).toContain("synthetic-2"));
    expect(view.result.current.qr).not.toBe(first.qr);
    expect(new URL(view.result.current.invite!.url).origin).toBe(new URL(first.url).origin);
    expect(issued).toBe(2);
    fail = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(view.result.current.invite!.expiresAt - Date.now());
    });
    await vi.waitFor(() => expect(view.result.current.error).toBeTruthy());
    expect(view.result.current.invite).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    expect(issued).toBe(3);
    fail = false;
    expiredResponse = true;
    act(() => view.result.current.createInvite());
    await vi.waitFor(() => expect(view.result.current.error).toBeTruthy());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(issued).toBe(4);
    expect(view.result.current.invite).toBeUndefined();
    expiredResponse = false;
    act(() => view.result.current.createInvite());
    await vi.waitFor(() => expect(view.result.current.invite?.url).toContain("synthetic-5"));
    expect(view.result.current.error).toBeNull();
    pending = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(view.result.current.invite).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(issued).toBe(5);
    pending = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(view.result.current.invite?.url).toContain("synthetic-6"));
    view.rerender({ ready: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(view.result.current.invite).toBeUndefined();
    expect(issued).toBe(6);
    view.rerender({ ready: true });
    await vi.waitFor(() => expect(view.result.current.invite?.url).toContain("synthetic-7"));
    view.unmount();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(issued).toBe(7);
  } finally {
    cleanup();
    client.clear();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("disconnect discards late QR results and a failed automatic generation waits for manual retry", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let finish: ((response: Response) => void) | undefined;
  let fail = false;
  let issued = 0;
  globalThis.fetch = vi.fn(async (url) => {
    if (url === "/api/remote-access/pairing") {
      issued++;
      return fail
        ? new Response(null, { status: 503 })
        : new Promise<Response>((resolve) => {
            finish = resolve;
          });
    }
    return Response.json({
      connected: true,
      connectionId: "synthetic-connection",
      devices: [],
      pending: [],
    });
  }) as typeof fetch;
  const { renderHook, cleanup, act } = await import("@testing-library/react/pure");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  try {
    const view = renderHook(({ ready }) => useRemoteDevices(ready), {
      wrapper,
      initialProps: { ready: true },
    });
    await vi.waitFor(() => expect(finish).toBeDefined());
    view.rerender({ ready: false });
    await act(async () => {
      finish!(
        Response.json({
          url: "https://example.test/#pair=synthetic",
          expiresAt: Date.now() + 300_000,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(view.result.current.invite).toBeUndefined();
    fail = true;
    view.rerender({ ready: true });
    await vi.waitFor(() => expect(view.result.current.error).toBeTruthy());
    expect(issued).toBe(2);
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    expect(issued).toBe(2);
    fail = false;
    finish = undefined;
    act(() => view.result.current.createInvite());
    await vi.waitFor(() => expect(finish).toBeDefined());
    await act(async () => {
      finish!(
        Response.json({
          url: "https://example.test/#pair=new-synthetic",
          expiresAt: Date.now() + 300_000,
        }),
      );
    });
    await vi.waitFor(() => expect(view.result.current.qr).toMatch(/^data:image\/png/));
    expect(issued).toBe(3);
    expect(view.result.current.error).toBeNull();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
