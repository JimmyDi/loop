import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { useWorkspace } from "../../state/workspace-store";
import { useRequests } from "../../state/request-store";
import { ProjectActions } from "./ProjectActions";

test("ProjectActions exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ProjectActions project={{ id: "p", name: "Example", cwd: "/example" }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Rename");
  expect(html).toContain("Remove");
  client.clear();
});

test.each([true, false])(
  "project removal clears selected and previous session data only after success: %s",
  async (success) => {
    const window = new Window();
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      fetch: globalThis.fetch,
    };
    const workspace = useWorkspace.getState();
    const requests = useRequests.getState();
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const prompts: string[] = [];
    Object.assign(window, {
      confirm: (message: string) => {
        prompts.push(message);
        return true;
      },
    });
    globalThis.fetch = (async (_url, init) =>
      init?.method === "DELETE"
        ? success
          ? new Response(null, { status: 204 })
          : Response.json({ code: "operation_failed" }, { status: 500 })
        : Response.json([])) as typeof fetch;
    try {
      useWorkspace.setState({ active: undefined, drafts: {}, images: {}, draftProjects: {} });
      useRequests.setState({ pending: {} });
      const state = useWorkspace.getState();
      for (const session of [
        { id: "other", workspaceId: "q" },
        { id: "previous", workspaceId: "p" },
        { id: "selected", workspaceId: "p" },
      ]) {
        state.open(session);
        state.draft(session.id, "Draft");
        state.attach(session.id, [{ type: "image", mimeType: "image/png", data: "AAAA" }]);
        useRequests
          .getState()
          .put(session.id, { requestId: session.id, streamId: "stream", text: "Draft" });
      }
      const ui = render(
        <QueryClientProvider client={client}>
          <ProjectActions project={{ id: "p", name: "Example", cwd: "/example" }} />
        </QueryClientProvider>,
      );
      fireEvent.click(ui.getByRole("button", { name: "Remove" }));
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("draft");
      if (success) {
        await waitFor(() => expect(useWorkspace.getState().active).toBeUndefined());
        expect(Object.keys(useWorkspace.getState().drafts)).toEqual(["other"]);
        expect(Object.keys(useWorkspace.getState().images)).toEqual(["other"]);
        expect(Object.keys(useRequests.getState().pending)).toEqual(["other"]);
      } else {
        await waitFor(() => expect(ui.getByRole("alert")).toBeTruthy());
        expect(useWorkspace.getState().active?.id).toBe("selected");
        expect(Object.keys(useWorkspace.getState().drafts)).toHaveLength(3);
        expect(Object.keys(useWorkspace.getState().images)).toHaveLength(3);
        expect(Object.keys(useRequests.getState().pending)).toHaveLength(3);
      }
    } finally {
      cleanup();
      client.clear();
      useWorkspace.setState(workspace, true);
      useRequests.setState(requests, true);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
