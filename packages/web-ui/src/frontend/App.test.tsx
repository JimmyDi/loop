import { setImmediate } from "node:timers/promises";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import { App } from "./App";

const shellLoaded = vi.hoisted(() => vi.fn());

vi.mock("./components/layout/AppShell", () => {
  shellLoaded();
  return { AppShell: () => <p>Private chat interface</p> };
});

test("pairing loads without the chat shell and approval loads the protected interface", async () => {
  const window = new Window({ url: "https://example.test/#pair=synthetic-invite" });
  window.document.head.innerHTML = '<meta name="loop-remote" content="1">';
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  let authorized = false;
  globalThis.fetch = vi.fn(async (input) => {
    if (String(input).endsWith("/auth/session")) {
      return Response.json({
        user: authorized
          ? {
              id: "00000000-0000-4000-8000-000000000001",
              username: "owner",
            }
          : null,
      });
    }
    return Response.json(
      authorized
        ? {
            mode: "remote",
            authorized: true,
            csrf: "synthetic-csrf",
            device: { id: "phone", name: "Phone", createdAt: 1, expiresAt: 2 },
          }
        : { mode: "remote", authorized: false },
    );
  }) as typeof fetch;
  const { render, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  try {
    const view = render(<App />);
    await waitFor(() => expect(view.getByRole("textbox", { name: "Device name" })).toBeTruthy());
    expect(shellLoaded).not.toHaveBeenCalled();
    expect(view.queryByText("Private chat interface")).toBeNull();
    authorized = true;
    await act(async () => {
      window.dispatchEvent(new window.Event("loop-remote-check"));
    });
    await waitFor(() => expect(view.getByText("Private chat interface")).toBeTruthy());
    expect(shellLoaded).toHaveBeenCalledOnce();
  } finally {
    await act(async () => {
      cleanup();
      // React's scheduler uses setImmediate; keep the DOM until queued callbacks finish.
      await setImmediate();
    });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
