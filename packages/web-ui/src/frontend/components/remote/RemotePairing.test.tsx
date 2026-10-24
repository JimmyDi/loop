import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { RemotePairing } from "./RemotePairing";

test.each(["unpaired", "unavailable"])(
  "opening without an invitation checks access then shows %s without claiming expiry",
  async (state) => {
    const window = new Window({ url: "https://example.test/" });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    let respond!: (response: Response) => void;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    ) as typeof fetch;
    const client = new QueryClient();
    const approved = vi.fn();
    const { render, cleanup, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemotePairing token="" onApproved={approved} />
        </QueryClientProvider>,
      );
      expect(view.getByRole("status").textContent).toBe("Checking device access…");
      expect(view.queryByRole("textbox")).toBeNull();
      await act(async () => {
        respond(
          state === "unavailable" ? new Response(null, { status: 503 }) : Response.json({ state }),
        );
      });
      await vi.waitFor(() =>
        expect(view.getByRole(state === "unavailable" ? "alert" : "status").textContent).toBe(
          state === "unavailable"
            ? "Pairing could not be completed. Check the connection or scan a new code."
            : "This browser is not paired. Scan the current pairing code on your computer.",
        ),
      );
      expect(view.container.textContent).not.toContain("expired");
      expect(view.queryByRole("textbox")).toBeNull();
      expect(approved).not.toHaveBeenCalled();
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);

test.each(["approved", "rejected", "expired"])(
  "pairing requests display a comparison code then handle %s",
  async (state) => {
    const window = new Window({ url: "https://example.test/" });
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    Object.assign(globalThis, { window, document: window.document });
    let status = "pending";
    const fetcher = vi.fn(async () => Response.json({ state: status, confirmation: "123456" }));
    globalThis.fetch = fetcher;
    const client = new QueryClient();
    const approved = vi.fn();
    const { render, cleanup, fireEvent, act } = await import("@testing-library/react/pure");
    try {
      const view = render(
        <QueryClientProvider client={client}>
          <RemotePairing token="synthetic-invite" onApproved={approved} />
        </QueryClientProvider>,
      );
      expect(fetcher).not.toHaveBeenCalled();
      fireEvent.change(view.getByRole("textbox", { name: "Device name" }), {
        target: { value: "Example phone" },
      });
      fireEvent.submit(view.container.querySelector("form")!);
      await vi.waitFor(() => expect(view.getByText("123456")).toBeTruthy());
      expect(fetcher).toHaveBeenCalledWith(
        "/api/remote-pairing",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "synthetic-invite", name: "Example phone" }),
        }),
      );
      expect(approved).not.toHaveBeenCalled();
      status = state;
      await act(async () => {
        await client.refetchQueries({ queryKey: ["remote-pairing"] });
      });
      await vi.waitFor(() => {
        if (state === "approved") expect(approved).toHaveBeenCalledOnce();
        else
          expect(view.getByRole("status").textContent).toContain(
            state === "rejected" ? "declined" : "expired",
          );
      });
    } finally {
      cleanup();
      client.clear();
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
