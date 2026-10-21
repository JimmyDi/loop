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
  const fetcher = vi.fn(async (url, init) => {
    if (url === "/api/remote-access/pairing" && init?.method === "POST")
      return Response.json({
        url: "https://example.test/#pair=synthetic-invite",
        expiresAt: Date.now() + 300_000,
      });
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
    pending = true;
    await act(async () => {
      await client.refetchQueries({ queryKey: ["remote-devices"] });
    });
    await vi.waitFor(() => expect(view.getByText("Confirmation code: 123456")).toBeTruthy());
    expect(view.queryByRole("img", { name: "Device pairing QR code" })).toBeNull();
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
