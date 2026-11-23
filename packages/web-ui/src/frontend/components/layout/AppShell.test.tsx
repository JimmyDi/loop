import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { useSettings } from "../../state/settings-store";
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

test("navigation routes restore Echo after refresh and respond to browser history", async () => {
  const window = new Window({ url: "http://localhost:3080/echo" });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    EventSource: globalThis.EventSource,
  };
  class LocalSource {
    close() {}
  }
  Object.assign(globalThis, { window, document: window.document, EventSource: LocalSource });
  const { render, fireEvent, cleanup, waitFor } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["projects"], []);
  client.setQueryData(["echo"], { version: 1, agents: [], conversations: [] });
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <AppShell />
      </QueryClientProvider>,
    );
    expect(view.getByRole("button", { name: "Echo" }).getAttribute("aria-current")).toBe("page");
    await waitFor(() => expect(view.getByRole("button", { name: "New Agent" })).toBeTruthy());
    fireEvent.click(view.getByRole("button", { name: "Home" }));
    expect(window.location.pathname).toBe("/");
    fireEvent.click(view.getByRole("button", { name: "Echo" }));
    expect(window.location.pathname).toBe("/echo");
    window.history.back();
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page"),
    );
  } finally {
    cleanup();
    useSettings.getState().close();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
