import { expect, test } from "vitest";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { ChatWorkspace } from "./ChatWorkspace";

test("ChatWorkspace exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ChatWorkspace id="example" />
    </QueryClientProvider>,
  );

  expect(html).toContain("Loading");
  expect(html).toContain("session-header");
  expect(html).not.toContain("<nav");
  client.clear();
});

test.each([
  { status: 404, code: "session_not_found", switchAway: false, cleared: true },
  { status: 500, code: "operation_failed", switchAway: false, cleared: false },
  { status: 404, code: "session_not_found", switchAway: true, cleared: false },
])(
  "failed session restore reconciles only missing active selections: %j",
  async ({ status, code, switchAway, cleared }) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, act, waitFor, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolve!: (value: Response) => void;
    globalThis.fetch = (() =>
      new Promise<Response>((done) => {
        resolve = done;
      })) as typeof fetch;
    try {
      useWorkspace.setState({
        active: { id: "missing", workspaceId: "project" },
        drafts: { missing: "Unsent draft" },
        images: { missing: [{ type: "image", data: "aA==", mimeType: "image/png" }] },
        files: { missing: [{ name: "example.txt", text: "Unsent attachment" }] },
      });
      const saved = useWorkspace.getState();
      const ui = render(
        <QueryClientProvider client={client}>
          <ChatWorkspace id="missing" />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(resolve).toBeTypeOf("function"));
      if (switchAway)
        act(() => useWorkspace.getState().open({ id: "other", workspaceId: "project" }));
      await act(async () =>
        resolve(Response.json({ code, message: "Example failure" }, { status })),
      );
      await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
      await waitFor(() =>
        expect(useWorkspace.getState().active?.id).toBe(
          cleared ? undefined : switchAway ? "other" : "missing",
        ),
      );
      expect(useWorkspace.getState().drafts).toEqual(saved.drafts);
      expect(useWorkspace.getState().images).toEqual(saved.images);
      expect(useWorkspace.getState().files).toEqual(saved.files);
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
