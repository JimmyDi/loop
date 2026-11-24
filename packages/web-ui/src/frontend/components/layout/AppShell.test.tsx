import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { AppShell } from "./AppShell";

test("AppShell exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>,
  );

  expect(html).toContain("app-shell");
  expect(html).toContain("Resize sidebar");
  expect(html).toContain("Projects");
  client.clear();
});

test("desktop sidebar toggle hides controls without remounting the session list", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    EventSource: globalThis.EventSource,
  };
  class Source {
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  Object.assign(globalThis, {
    window,
    document: window.document,
    EventSource: Source,
    fetch: async () => new Response(null, { status: 503 }),
  });
  const { render, act, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <AppShell />
      </QueryClientProvider>,
    );
    const shell = view.container.querySelector(".app-shell")!;
    const content = view.container.querySelector(".sidebar-content")!;
    const toggle = view.container.querySelector<HTMLButtonElement>(".web-sidebar-toggle")!;
    expect(shell.getAttribute("data-sidebar-collapsed")).toBe("false");
    await act(() => {
      toggle.click();
    });
    expect(shell.getAttribute("data-sidebar-collapsed")).toBe("true");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(content.hasAttribute("inert")).toBe(true);
    expect(view.container.querySelector(".navigation-bar")!.hasAttribute("inert")).toBe(true);
    await act(() => {
      window.dispatchEvent(new window.Event("loop:toggle-desktop-sidebar"));
    });
    expect(content.hasAttribute("inert")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelector(".navigation-bar")!.hasAttribute("inert")).toBe(false);
    expect(view.container.querySelector(".sidebar-content")).toBe(content);
  } finally {
    cleanup();
    client.clear();
    await new Promise((resolve) => setTimeout(resolve, 20));
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
