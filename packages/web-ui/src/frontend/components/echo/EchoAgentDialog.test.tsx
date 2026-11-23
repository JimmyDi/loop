import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { EchoAgentDialog } from "./EchoAgentDialog";

test("Agent form opens in a dialog and submits its profile", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const fetch = vi.fn().mockResolvedValue(Response.json({ id: "created" }));
  globalThis.fetch = fetch;
  const created = vi.fn();
  try {
    const view = render(<EchoAgentDialog onClose={() => {}} onCreated={created} />);
    expect(view.getByRole("dialog", { name: "New Agent" })).toBeTruthy();
    fireEvent.change(view.getByRole("textbox", { name: "Agent name" }), {
      target: { value: " Researcher " },
    });
    fireEvent.submit(view.getByRole("dialog").querySelector("form")!);
    await waitFor(() => expect(created).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0]![0]).toBe("/api/echo/agents");
    expect(JSON.parse(fetch.mock.calls[0]![1].body).name).toBe("Researcher");
  } finally {
    cleanup();
    globalThis.fetch = previous.fetch;
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    await window.happyDOM.close();
  }
});
