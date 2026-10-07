import { expect, test } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { McpSettings } from "./McpSettings";
import type { McpServerView } from "../../../shared/mcp";

test("MCPs supports search, Add dropdown, persisted toggles, editing and deletion", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  let servers: McpServerView[] = [
    {
      id: "example",
      name: "Example",
      enabled: false,
      transport: "stdio",
      command: "node",
      args: [],
      env: [{ key: "EXAMPLE", value: "", saved: true }],
      envVars: [],
      cwd: "",
      status: "disabled",
      toolCount: 0,
    },
  ];
  client.setQueryData(["mcp-settings"], { servers });
  const requests: { url: string; method?: string; body?: unknown }[] = [];
  let failSave = false;
  let saveStatus: McpServerView["status"] = "connecting";
  globalThis.fetch = (async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url: String(url), method: init?.method, body });
    if (failSave && init?.method === "POST")
      return Response.json(
        { code: "synthetic_save_failed", message: "Synthetic save failed" },
        { status: 500 },
      );
    if (init?.method === "PATCH")
      servers = servers.map((server) => ({
        ...server,
        enabled: body.enabled,
        status: "connecting",
      }));
    if (init?.method === "DELETE") servers = [];
    if (init?.method === "POST" && !String(url).endsWith("/retry"))
      servers = [{ ...body, status: "connecting", toolCount: 0 }];
    if (init?.method === "PUT") servers = [{ ...body, status: saveStatus, toolCount: 0 }];
    return Response.json({ servers });
  }) as typeof fetch;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <QueryClientProvider client={client}>
        <div className="settings-content">
          <McpSettings />
        </div>
      </QueryClientProvider>,
    );
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "missing" } });
    expect(view.queryByText("Example")).toBeNull();
    expect(view.getByText("No matching MCP servers.")).toBeTruthy();
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "EXAMPLE" } });
    expect(view.getByText("Example")).toBeTruthy();
    await act(async () => fireEvent.click(view.getByRole("switch", { name: "Enable Example" })));
    expect(requests[0]).toMatchObject({ method: "PATCH", body: { enabled: true } });
    expect(view.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(view.getByText("STDIO")).toBeTruthy();
    expect(view.container.querySelector(".mcp-server-list .plugin-list-hint")).toBeNull();
    for (const [status, label] of [
      ["queued", "Waiting for a connection slot…"],
      ["refreshing", "Refreshing tools…"],
    ] as const) {
      client.setQueryData(["mcp-settings"], { servers: [{ ...servers[0], status }] });
      await waitFor(() => expect(view.getByText(label)).toBeTruthy());
      expect(view.queryByRole("button", { name: "Retry" })).toBeNull();
    }
    client.setQueryData(["mcp-settings"], {
      servers: [{ ...servers[0], status: "error", error: "missing_environment" }],
    });
    await waitFor(() =>
      expect(view.getByText(/A referenced environment variable is missing/)).toBeTruthy(),
    );
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Retry" })));
    expect(requests.at(-1)!.url).toContain("/example/retry");
    fireEvent.click(view.getByRole("button", { name: "Configure Example" }));
    expect((view.getByLabelText("Environment variables Value 1") as HTMLInputElement).value).toBe(
      "",
    );
    fireEvent.click(view.getByRole("button", { name: "Delete" }));
    await act(async () => fireEvent.click(view.getAllByRole("button", { name: "Delete" })[0]!));
    expect(view.getByText("No MCP servers yet. Add a server to get started.")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Add/ }));
    expect(view.getByRole("menuitem", { name: "Add MCP server" })).toBeTruthy();
    fireEvent.keyDown(view.getByRole("menuitem", { name: "Add MCP server" }), { key: "Escape" });
    expect(view.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Add" }));
    fireEvent.click(view.getByRole("button", { name: "Add" }));
    const addOption = view.getByRole("menuitem", { name: "Add MCP server" });
    fireEvent.pointerDown(addOption);
    fireEvent.blur(addOption, { relatedTarget: document.body });
    fireEvent.click(addOption);
    expect(view.getByLabelText("Name")).toBeTruthy();
    expect(view.getByRole("heading", { name: "MCPs" })).toBeTruthy();
    expect(view.getByText("Manage MCPs")).toBeTruthy();
    expect((view.getByRole("searchbox") as HTMLInputElement).value).toBe("EXAMPLE");
    expect(view.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(true);
    expect(view.queryByRole("heading", { name: "Servers" })).toBeNull();
    expect(view.getByLabelText("Arguments Value 1")).toBeTruthy();
    expect(view.getByLabelText("Environment variables Key 1")).toBeTruthy();
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "New server" } });
    fireEvent.change(view.getByLabelText("Command to launch"), { target: { value: "node" } });
    const content = view.container.querySelector<HTMLElement>(".settings-content")!;
    content.scrollTop = 360;
    failSave = true;
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(view.getByText("Synthetic save failed")).toBeTruthy();
    expect(view.getByLabelText("Name")).toBeTruthy();
    expect(content.scrollTop).toBe(360);
    failSave = false;
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(requests.at(-1)!.method).toBe("POST");
    expect(view.getByLabelText("Name")).toBeTruthy();
    expect(content.scrollTop).toBe(360);
    expect(view.getByRole("status").textContent).toContain("Please wait a moment.");
    expect(view.container.querySelector(".mcp-setup-spinner")).toBeTruthy();
    expect(view.container.querySelector(".mcp-form-overlay")).toBeTruthy();
    expect(view.container.querySelector(".mcp-form-body")!.getAttribute("aria-busy")).toBe("true");
    expect(view.getByRole("button", { name: "Checking…" }).hasAttribute("disabled")).toBe(true);
    expect(view.getByRole("button", { name: /Back/ }).hasAttribute("disabled")).toBe(false);
    client.setQueryData(["mcp-settings"], {
      servers: [{ ...servers[0], status: "error", error: "connection_timeout" }],
    });
    await waitFor(() => expect(view.getByRole("status").textContent).toContain("timed out"));
    expect(view.container.querySelector(".mcp-form-overlay")).toBeNull();
    expect(view.getByLabelText("Name")).toBeTruthy();
    expect(content.scrollTop).toBe(360);
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(requests.at(-1)!.method).toBe("PUT");
    client.setQueryData(["mcp-settings"], {
      servers: [{ ...servers[0], status: "ready", toolCount: 14 }],
    });
    await waitFor(() => expect(view.queryByLabelText("Name")).toBeNull());
    expect(view.container.querySelector(".mcp-setup-spinner")).toBeNull();
    expect(view.container.querySelector(".mcp-form-overlay")).toBeNull();
    expect(view.getByRole("searchbox")).toBeTruthy();
    expect(view.getByRole("button", { name: "Add" }).hasAttribute("disabled")).toBe(false);
    fireEvent.change(view.getByRole("searchbox"), { target: { value: "" } });
    expect(view.getByText(/14 tools/)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Configure New server" }));
    expect(view.getByLabelText("Name")).toBeTruthy();
    saveStatus = "ready";
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    await waitFor(() => expect(view.queryByLabelText("Name")).toBeNull());
    fireEvent.click(view.getByRole("button", { name: "Configure New server" }));
    expect(view.getByLabelText("Name")).toBeTruthy();
    saveStatus = "disabled";
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    await waitFor(() => expect(view.queryByLabelText("Name")).toBeNull());
  } finally {
    cleanup();
    client.clear();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
