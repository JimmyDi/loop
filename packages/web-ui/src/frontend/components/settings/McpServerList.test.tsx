import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { McpServerView } from "../../../shared/mcp";
import { i18n } from "../../i18n/setup";
import { McpServerList } from "./McpServerList";

test("list separates unloaded, empty and filtered states and matches names without case sensitivity", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const server: McpServerView = {
    id: "example",
    name: "Example",
    enabled: false,
    transport: "stdio",
    command: "node",
    args: [],
    env: [],
    envVars: [],
    cwd: "",
    status: "disabled",
    toolCount: 0,
  };
  const actions = { pending: false, onEdit: () => {}, onRetry: () => {}, onToggle: () => {} };
  try {
    await i18n.changeLanguage("en");
    const view = render(<McpServerList servers={[]} search="" loaded={false} {...actions} />);
    expect(view.queryByText(/No MCP servers yet/)).toBeNull();
    view.rerender(<McpServerList servers={[]} search="" loaded {...actions} />);
    expect(view.getByText(/No MCP servers yet/)).toBeTruthy();
    view.rerender(<McpServerList servers={[server]} search="EXAMP" loaded {...actions} />);
    expect(view.getByText("Example")).toBeTruthy();
    view.rerender(<McpServerList servers={[server]} search="missing" loaded {...actions} />);
    expect(view.queryByText("Example")).toBeNull();
    expect(view.getByText("No matching MCP servers.")).toBeTruthy();
    expect(view.queryByText(/No MCP servers yet/)).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
