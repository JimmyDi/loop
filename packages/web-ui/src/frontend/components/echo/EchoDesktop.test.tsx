import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { expect, test, vi } from "vitest";

import "../../i18n/setup";
import { EchoDesktop } from "./EchoDesktop";

test("desktop watching has an accessible loading state", () => {
  const html = renderToStaticMarkup(
    <EchoDesktop computerId="computer" state="running" onClose={() => {}} />,
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-label="Sandbox desktop"');
  expect(html).toContain('aria-label="Close desktop"');
});

test("stopped computer shows its state without starting screenshot polling", () => {
  const html = renderToStaticMarkup(
    <EchoDesktop computerId="computer" state="stopped" onClose={() => {}} />,
  );
  expect(html).toContain("Computer stopped. Select Start above.");
  expect(html).not.toContain("Loading desktop");
});

test("desktop preview retains its last frame through a failed refresh", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(new Blob(["image"]), { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  globalThis.fetch = fetch;
  vi.useFakeTimers();
  const { render, cleanup, act } = await import("@testing-library/react/pure");
  try {
    const view = render(<EchoDesktop computerId="computer" state="running" onClose={() => {}} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.getByAltText("Echo desktop").getAttribute("src")).toBe("blob:preview");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(view.getByAltText("Echo desktop").getAttribute("src")).toBe("blob:preview");
    expect(view.getByRole("status").textContent).toBe("Desktop reconnecting…");
  } finally {
    cleanup();
    vi.useRealTimers();
    globalThis.fetch = previous.fetch;
    Object.assign(globalThis, { window: previous.window, document: previous.document });
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    await window.happyDOM.close();
  }
});
