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
      devices: [{ id: "device", name: "Paired phone", createdAt: 1, expiresAt: 2 }],
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
    expect(view.getByRole("link").textContent).toBe("Open pairing link");
    expect(view.container.textContent).not.toContain("example.test");
    const refresh = view.getByRole("button", { name: "Refresh pairing code" }) as HTMLButtonElement;
    expect(refresh.title).toBe("Refresh pairing code");
    expect(refresh.textContent).toBe("");
    expect(refresh.querySelector("svg")).toBeTruthy();
    expect(
      refresh.closest(".remote-access-step-title")?.querySelector("h4")?.previousElementSibling,
    ).toBe(refresh.closest(".remote-access-actions"));
    await vi.waitFor(() => expect(refresh.disabled).toBe(false));
    const oldUrl = view.getByRole("link").getAttribute("href")!;
    const oldQr = view.getByRole("img", { name: "Device pairing QR code" }).getAttribute("src");
    fireEvent.click(refresh);
    expect(refresh.disabled).toBe(true);
    await vi.waitFor(() => expect(view.getByRole("link").getAttribute("href")).not.toBe(oldUrl));
    expect(new URL(view.getByRole("link").getAttribute("href")!).origin).toBe(
      new URL(oldUrl).origin,
    );
    expect(view.getByRole("img", { name: "Device pairing QR code" }).getAttribute("src")).not.toBe(
      oldQr,
    );
    expect(invitations).toBe(2);
    pending = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(view.getByText("Confirmation code: 123456")).toBeTruthy());
    expect(view.queryByRole("img", { name: "Device pairing QR code" })).toBeNull();
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
