import { setImmediate as flushScheduledWork } from "node:timers/promises";
import {
  defaultScheduler,
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { RemoteAccessPanel } from "./RemoteAccessPanel";

test("desktop remote access combines tunnel setup and paired-device management", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <RemoteAccessPanel />
    </QueryClientProvider>,
  );
  expect(html).toContain("Install Dev Tunnels CLI");
  expect(html).toContain("Paired devices");
  expect(html).toContain("Step 4");
  expect(html).toContain("Refresh pairing code");
  expect(html.match(/<li /g)).toHaveLength(4);
  client.clear();
});

test("Step 4 generates automatically only after Step 3 completes and hides its code on disconnect", async () => {
  const { Window } = await import("happy-dom");
  const { vi } = await import("vitest");
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  let connected = false;
  const fetcher = vi.fn(async (url) => {
    if (String(url).startsWith("/api/remote-access?") || url === "/api/remote-access")
      return Response.json({
        supported: true,
        installed: true,
        signedIn: true,
        phase: connected ? "connected" : "connecting",
      });
    if (url === "/api/remote-access/devices")
      return Response.json({
        connected: true,
        connectionId: "synthetic-connection",
        devices: [],
        pending: [],
      });
    return Response.json({
      url: "https://example.test/#pair=synthetic",
      expiresAt: Date.now() + 300_000,
    });
  });
  globalThis.fetch = fetcher as typeof fetch;
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  notifyManager.setScheduler(queueMicrotask);
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteAccessPanel />
      </QueryClientProvider>,
    );
    await vi.waitFor(() =>
      expect(view.getByRole("progressbar", { name: "Connect Tunnel" })).toBeTruthy(),
    );
    expect(view.queryByRole("img", { name: "Device pairing QR code" })).toBeNull();
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/remote-access/pairing")).toHaveLength(
      0,
    );
    connected = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-access"] });
    });
    await vi.waitFor(() =>
      expect(view.getByRole("img", { name: "Device pairing QR code" })).toBeTruthy(),
    );
    const steps = view.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps[3]?.textContent).toContain("Step 4Paired devices");
    expect(steps[2]?.getAttribute("data-complete")).toBe("true");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/remote-access/pairing")).toHaveLength(
      1,
    );
    connected = false;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-access"] });
    });
    await vi.waitFor(() =>
      expect(view.queryByRole("img", { name: "Device pairing QR code" })).toBeNull(),
    );
  } finally {
    await act(async () => {
      await client.cancelQueries();
      cleanup();
      client.clear();
      // React's scheduler can retain an immediate callback after unmount.
      await flushScheduledWork();
    });
    notifyManager.setScheduler(defaultScheduler);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
