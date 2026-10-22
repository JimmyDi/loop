import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { RemoteDevicesSettings } from "./RemoteDevicesSettings";

test("desktop generates a QR code and explicitly approves, declines and revokes devices", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  let pending = false;
  let invitations = 0;
  const fetcher = vi.fn(async (url, init) => {
    if (url === "/api/remote-access/pairing" && init?.method === "POST") {
      invitations++;
      return Response.json({
        url: "https://example.test/#pair=synthetic-invite-" + invitations,
        expiresAt: Date.now() + 300_000,
      });
    }
    return Response.json({
      connected: true,
      connectionId: "synthetic-connection",
      devices: [
        { id: "device", name: "Paired phone", createdAt: 1, expiresAt: Date.now() + 86_400_000 },
      ],
      expiredDevices: [],
      pending: pending
        ? [
            {
              id: "pending",
              name: "New phone",
              confirmation: "123456",
              expiresAt: Date.now() + 300_000,
            },
          ]
        : [],
    });
  });
  globalThis.fetch = fetcher as typeof fetch;
  const client = new QueryClient();
  const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteDevicesSettings />
      </QueryClientProvider>,
    );
    expect(view.getByText("Step 4")).toBeTruthy();
    await vi.waitFor(() =>
      expect(view.getByRole("img", { name: "Device pairing QR code" }).getAttribute("src")).toMatch(
        /^data:image\/png;base64,/,
      ),
    );
    expect(view.queryByRole("link")).toBeNull();
    const qr = view.getByRole("img", { name: "Device pairing QR code" });
    const list = view.container.querySelector(".remote-devices-list")!;
    expect(qr.parentElement?.nextElementSibling).toBe(list);
    expect(list.contains(view.getByRole("group", { name: "Paired phone" }))).toBe(true);
    const scan = view.getByText("Scan with your phone.");
    expect(scan.previousElementSibling).toBe(view.getByRole("heading", { name: "Paired devices" }));
    expect(view.container.textContent).not.toContain("example.test");
    const refresh = view.getByRole("button", { name: "Refresh pairing code" }) as HTMLButtonElement;
    expect(refresh.title).toBe("Refresh pairing code");
    expect(refresh.textContent).toBe("");
    expect(refresh.querySelector("svg")).toBeTruthy();
    expect(
      refresh.closest(".remote-access-step-title")?.querySelector("h4")?.previousElementSibling,
    ).toBe(refresh.closest(".remote-access-actions"));
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    const oldQr = view.getByRole("img", { name: "Device pairing QR code" }).getAttribute("src");
    fireEvent.click(refresh);
    expect(refresh.disabled).toBe(true);
    await vi.waitFor(() =>
      expect(
        view.getByRole("img", { name: "Device pairing QR code" }).getAttribute("src"),
      ).not.toBe(oldQr),
    );
    expect(invitations).toBe(2);
    pending = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(view.getByText("Confirmation code: 123456")).toBeTruthy());
    expect(view.queryByRole("img", { name: "Device pairing QR code" })).toBeNull();
    expect(view.queryByText(scan.textContent!)).toBeNull();
    expect(refresh.disabled).toBe(true);
    for (const [label, approve] of [
      ["Approve", true],
      ["Decline", false],
    ] as const) {
      const button = view.getByRole("button", { name: label }) as HTMLButtonElement;
      await vi.waitFor(() => expect(button.disabled).toBe(false));
      fireEvent.click(button);
      await vi.waitFor(() =>
        expect(fetcher).toHaveBeenCalledWith(
          "/api/remote-access/pairing/pending",
          expect.objectContaining({ method: "POST", body: JSON.stringify({ approve }) }),
        ),
      );
    }
    const revoke = view.getByRole("button", { name: "Revoke access" }) as HTMLButtonElement;
    await vi.waitFor(() => expect(revoke.disabled).toBe(false));
    fireEvent.click(revoke);
    await vi.waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/remote-access/devices/device",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await vi.waitFor(() => expect(revoke.disabled).toBe(false));
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("approval shows green checks, expired devices show crosses and valid devices keep Step 4 complete", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient();
  const lifetime = 14 * 86_400_000;
  const first = {
    id: "first",
    name: "First phone",
    createdAt: Date.now(),
    expiresAt: Date.now() + lifetime,
  };
  let approved = false;
  let removed = false;
  let another = false;
  globalThis.fetch = vi.fn(async (url, init) => {
    if (url === "/api/remote-access/pairing/request") {
      approved = true;
      return new Response(null, { status: 204 });
    }
    if (init?.method === "DELETE") {
      removed = true;
      return new Response(null, { status: 204 });
    }
    if (url === "/api/remote-access/pairing")
      return Response.json({
        url: "https://example.test/#pair=synthetic",
        expiresAt: Date.now() + 300_000,
      });
    const expired = first.expiresAt <= Date.now();
    return Response.json({
      connected: true,
      connectionId: "synthetic-connection",
      devices: [
        ...(approved && !removed && !expired ? [first] : []),
        ...(another
          ? [{ ...first, id: "second", name: "Second phone", expiresAt: Date.now() + lifetime }]
          : []),
      ],
      expiredDevices: approved && !removed && expired ? [first] : [],
      pending: approved
        ? []
        : [
            {
              id: "request",
              name: "First phone",
              confirmation: "123456",
              expiresAt: Date.now() + 300_000,
            },
          ],
    });
  }) as typeof fetch;
  const { render, cleanup, fireEvent, act, within } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <RemoteDevicesSettings />
      </QueryClientProvider>,
    );
    const marker = () =>
      view.container.querySelector(".remote-devices-step > .remote-access-marker")!;
    await vi.waitFor(() => expect(view.getByRole("button", { name: "Approve" })).toBeTruthy());
    expect(marker().getAttribute("data-state")).toBe("incomplete");
    fireEvent.click(view.getByRole("button", { name: "Approve" }));
    await vi.waitFor(() => expect(marker().getAttribute("data-state")).toBe("completed"));
    const phone = view.getByRole("group", { name: "First phone" });
    expect(within(phone).getByRole("img", { name: "Completed" })).toBeTruthy();
    expect(phone.textContent).toContain("Paired · Access expires");
    const expiryDate = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(first.expiresAt);
    expect(phone.textContent).toContain(expiryDate);
    const refresh = view.getByRole("button", { name: "Refresh pairing code" }) as HTMLButtonElement;
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    fireEvent.click(refresh);
    expect(marker().getAttribute("data-state")).toBe("completed");
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(first.expiresAt);
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(marker().getAttribute("data-state")).toBe("failed"));
    expect(within(phone).getByRole("img", { name: "Check failed" })).toBeTruthy();
    expect(phone.textContent).toContain("Expired · Pair again to restore access");
    another = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(marker().getAttribute("data-state")).toBe("completed"));
    expect(within(phone).getByRole("img", { name: "Check failed" })).toBeTruthy();
    another = false;
    fireEvent.click(within(phone).getByRole("button", { name: "Remove device" }));
    await vi.waitFor(() => expect(view.queryByRole("group", { name: "First phone" })).toBeNull());
    expect(marker().getAttribute("data-state")).toBe("incomplete");
  } finally {
    cleanup();
    client.clear();
    vi.useRealTimers();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
