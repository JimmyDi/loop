import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { EchoSettings } from "./EchoSettings";

test("connection dialog renders a write-only credential field", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <EchoSettings
        connection={{
          provider: "loop-sandbox",
          endpoint: "https://computer.example",
          tokenSaved: true,
          idleSeconds: 900,
          desktop: true,
        }}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );
    expect(view.getByRole("dialog", { name: "Sandbox connection" })).toBeTruthy();
    expect(view.getByLabelText("Token").getAttribute("type")).toBe("password");
    expect(view.getByLabelText("Token").getAttribute("placeholder")).toBe("Saved");
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("connection form saves through the PUT endpoint", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const requests: { url: string; method?: string; body?: string }[] = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), method: init?.method, body: String(init?.body) });
    return Response.json({ provider: "loop-sandbox" });
  }) as typeof fetch;
  const saved = vi.fn();
  try {
    const view = render(<EchoSettings onSaved={saved} onClose={() => {}} />);
    fireEvent.change(view.getByLabelText("Token"), { target: { value: "synthetic-token" } });
    fireEvent.submit(view.getByRole("dialog").querySelector("form")!);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(requests).toEqual([
      {
        url: "/api/echo/connection",
        method: "PUT",
        body: JSON.stringify({
          provider: "loop-sandbox",
          endpoint: "http://localhost:8080",
          token: "synthetic-token",
          desktop: true,
          idleSeconds: 900,
        }),
      },
    ]);
  } finally {
    cleanup();
    globalThis.fetch = previous.fetch;
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    await window.happyDOM.close();
  }
});
