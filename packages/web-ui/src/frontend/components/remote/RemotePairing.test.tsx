import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { RemotePairing } from "./RemotePairing";

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
