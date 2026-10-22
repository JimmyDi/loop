import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import {
  remoteCsrfHeaders,
  checkRemoteSession,
  setBootstrapSession,
  takeBootstrapSession,
  setRemoteCsrf,
} from "../../lib/remote-session";
import { useSessions } from "../../state/session-store";
import { RemoteAccessGate } from "./RemoteAccessGate";

test("local pages render directly without probing remote authorization", () => {
  const client = new QueryClient();
  expect(
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <RemoteAccessGate>
          <p>Local app</p>
        </RemoteAccessGate>
      </QueryClientProvider>,
    ),
  ).toContain("Local app");
  expect(client.getQueryState(["remote-session"])?.fetchStatus).toBe("idle");
  client.clear();
});

test("a fresh bootstrap authorization opens chat without a duplicate check and revocation still rechecks", async () => {
  const window = new Window({ url: "https://example.test/" });
  window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  const client = new QueryClient();
  const fetcher = vi.fn(async () => Response.json({ mode: "remote", authorized: false }));
  globalThis.fetch = fetcher;
  setBootstrapSession({
    mode: "remote",
    authorized: true,
    csrf: "synthetic-csrf",
    device: { id: "phone", name: "Phone", createdAt: 1, expiresAt: 2 },
  });
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <RemoteAccessGate>
          <p>Private chats</p>
        </RemoteAccessGate>
      </QueryClientProvider>,
    );
    expect(ui.getByText("Private chats")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
    expect(remoteCsrfHeaders("POST")).toEqual({ "X-Loop-CSRF": "synthetic-csrf" });
    await act(async () => {
      checkRemoteSession();
    });
    await vi.waitFor(() => expect(ui.queryByText("Private chats")).toBeNull());
    expect(fetcher).toHaveBeenCalled();
    expect(remoteCsrfHeaders("POST")).toEqual({});
  } finally {
    cleanup();
    client.clear();
    takeBootstrapSession();
    setRemoteCsrf();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("remote bootstrap mounts no business hooks until approved and clears snapshots after revocation", async () => {
  const window = new Window({ url: "https://example.test/#pair=synthetic-invite" });
  window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  const client = new QueryClient();
  let authorized = false;
  globalThis.fetch = vi.fn(async () =>
    Response.json(
      authorized
        ? {
            mode: "remote",
            authorized: true,
            csrf: "synthetic-csrf",
            device: { id: "example", name: "Phone", createdAt: 1, expiresAt: 2 },
          }
        : { mode: "remote", authorized: false },
    ),
  ) as typeof fetch;
  const mounted = vi.fn();
  const Business = () => {
    useEffect(() => {
      mounted();
    }, []);
    return <p>Private chats</p>;
  };
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessGate>
          <Business />
        </RemoteAccessGate>
      </QueryClientProvider>,
    );
    expect(view.queryByText("Private chats")).toBeNull();
    expect(mounted).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
    await vi.waitFor(() =>
      expect(view.getByRole("button", { name: "Request access" })).toBeTruthy(),
    );
    expect(mounted).not.toHaveBeenCalled();
    authorized = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-session"] });
    });
    await vi.waitFor(() => expect(mounted).toHaveBeenCalledOnce());
    expect(remoteCsrfHeaders("POST")).toEqual({ "X-Loop-CSRF": "synthetic-csrf" });
    client.setQueryData(["sessions", "example"], [{ title: "Synthetic chat" }]);
    useSessions.setState({ views: { example: { connected: true } } });
    authorized = false;
    await act(async () => {
      checkRemoteSession();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await vi.waitFor(() => expect(view.queryByText("Private chats")).toBeNull());
    expect(client.getQueryData(["sessions", "example"])).toBeUndefined();
    expect(useSessions.getState().views).toEqual({});
    expect(remoteCsrfHeaders("POST")).toEqual({});
    expect(view.queryByRole("button", { name: "Request access" })).toBeNull();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("an unreachable authorization endpoint stays closed with a retry action", async () => {
  const window = new Window({ url: "https://example.test/" });
  window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    Event: globalThis.Event,
  };
  Object.assign(globalThis, { window, document: window.document, Event: window.Event });
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch;
  const client = new QueryClient();
  const { render, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessGate>
          <p>Private chats</p>
        </RemoteAccessGate>
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
    expect(view.queryByText("Private chats")).toBeNull();
    expect(view.getByRole("button", { name: "Retry" })).toBeTruthy();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
