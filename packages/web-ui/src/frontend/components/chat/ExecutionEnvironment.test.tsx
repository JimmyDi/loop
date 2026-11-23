import { expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import type { SessionSnapshot } from "../../../shared/protocol";
import { useWorkspace } from "../../state/workspace-store";
import { ExecutionEnvironment } from "./ExecutionEnvironment";

test("environment selection is available before use and reset status stays visible", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["execution-environments"], {
    sandboxAvailable: true,
    servers: [{ id: "custom", name: "Custom sandbox", status: "ready" }],
  });
  const snapshot = {
    sessionId: "synthetic",
    workspaceId: null,
    model: { provider: "synthetic", id: "model", name: "Model" },
    state: { execution: "sandbox", sandbox: { generation: 2 } },
  } as SessionSnapshot;
  const previousFetch = globalThis.fetch;
  const previousWorkspace = useWorkspace.getState();
  const requests: unknown[] = [];
  const next = {
    ...snapshot,
    sessionId: "new-draft",
    state: { ...snapshot.state, execution: "local" },
  };
  globalThis.fetch = vi.fn(async (_url, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json(next);
  });
  useWorkspace.setState({ active: { id: snapshot.sessionId, workspaceId: null } });
  try {
    const ui = render(
      <QueryClientProvider client={client}>
        <ExecutionEnvironment snapshot={snapshot} editable />
      </QueryClientProvider>,
    );
    expect((ui.getByRole("combobox") as HTMLSelectElement).value).toBe("sandbox");
    expect(ui.getByText(/previous files discarded/)).toBeTruthy();
    expect(ui.getByRole("option", { name: "Custom sandbox · MCP" })).toBeTruthy();
    fireEvent.change(ui.getByRole("combobox"), { target: { value: "mcp:custom" } });
    await waitFor(() => expect(useWorkspace.getState().active?.id).toBe("new-draft"));
    expect(requests[0]).toEqual({ workspaceId: null, execution: "mcp:custom" });
    ui.rerender(
      <QueryClientProvider client={client}>
        <ExecutionEnvironment snapshot={snapshot} editable={false} />
      </QueryClientProvider>,
    );
    expect(ui.queryByRole("combobox")).toBeNull();
    expect(ui.getByText("Loop Sandbox")).toBeTruthy();
  } finally {
    cleanup();
    globalThis.fetch = previousFetch;
    useWorkspace.setState(previousWorkspace, true);
    client.clear();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
