import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import type { McpServerView } from "../../../shared/mcp";
import { i18n } from "../../i18n/setup";
import { McpServerRow } from "./McpServerRow";

test("row routes exact server actions and blocks them while pending", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const server: McpServerView = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [],
    envHeaders: [],
    status: "error",
    toolCount: 0,
    error: "missing_environment",
  };
  const actions = { onEdit: vi.fn(), onRetry: vi.fn(), onToggle: vi.fn() };
  try {
    await i18n.changeLanguage("en");
    const view = render(<McpServerRow server={server} pending={false} {...actions} />);
    expect(view.getByText("Streamable HTTP")).toBeTruthy();
    expect(view.getByText(/A referenced environment variable is missing/)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Retry" }));
    fireEvent.click(view.getByRole("button", { name: "Configure Example" }));
    fireEvent.click(view.getByRole("switch"));
    expect(actions.onRetry).toHaveBeenCalledWith("example");
    expect(actions.onEdit).toHaveBeenCalledWith(server);
    expect(actions.onToggle).toHaveBeenCalledWith("example", false);
    view.rerender(<McpServerRow server={server} pending {...actions} />);
    fireEvent.click(view.getByRole("button", { name: "Retry" }));
    fireEvent.click(view.getByRole("button", { name: "Configure Example" }));
    fireEvent.click(view.getByRole("switch"));
    expect(actions.onRetry).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onToggle).toHaveBeenCalledOnce();
    view.rerender(
      <McpServerRow
        server={{ ...server, status: "ready", error: undefined, toolCount: 2 }}
        pending={false}
        {...actions}
      />,
    );
    expect(view.getByText(/Connected.*2 tools/)).toBeTruthy();
    expect(view.queryByRole("button", { name: "Retry" })).toBeNull();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
