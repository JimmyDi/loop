import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRef } from "react";
import { Window } from "happy-dom";

import type { SessionSnapshot } from "../../../shared/protocol";
import "../../i18n/setup";
import { SessionHeader } from "./SessionHeader";

test("SessionHeader exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <SessionHeader />
    </QueryClientProvider>,
  );

  expect(html).toContain("New session");
  expect(html).toContain("<svg");
  expect(html).toContain("Open projects");
  expect(html).not.toContain("Rename conversation");
  expect(html).not.toContain("Regenerate title");
  expect(html).not.toContain("session-heading");
  expect(html).not.toContain("session-header-actions");
  client.clear();
});

test("SessionHeader exposes an action target only when requested", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const actions = createRef<HTMLDivElement>();
  const snapshot = {
    sessionId: "header-test",
    operation: "idle",
    state: { hasPendingSave: false, title: { text: "Example conversation" } },
  } as unknown as SessionSnapshot;
  const { render, cleanup } = await import("@testing-library/react/pure");
  try {
    const view = render(
      <QueryClientProvider client={client}>
        <SessionHeader snapshot={snapshot} actionsRef={actions} />
      </QueryClientProvider>,
    );
    expect(actions.current).toBe(view.container.querySelector(".session-header-actions"));
    expect(actions.current?.previousElementSibling?.className).toBe("session-name");
    expect(actions.current?.nextElementSibling).toBeNull();

    view.rerender(
      <QueryClientProvider client={client}>
        <SessionHeader snapshot={snapshot} />
      </QueryClientProvider>,
    );
    expect(actions.current).toBeNull();
    expect(view.container.querySelector(".session-header-actions")).toBeNull();
  } finally {
    cleanup();
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
