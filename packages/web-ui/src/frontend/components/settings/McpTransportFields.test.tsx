import { expect, test } from "vitest";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { McpTransportFields } from "./McpTransportFields";
import type { McpServerConfig } from "../../../shared/mcp";

test("transport fields separate literal headers from environment references", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let value: McpServerConfig = {
    id: "example",
    name: "Example",
    enabled: false,
    transport: "http",
    url: "",
    bearerTokenEnv: "",
    headers: [{ key: "", value: "" }],
    envHeaders: [{ key: "", value: "" }],
  };
  try {
    const view = render(
      <McpTransportFields
        value={value}
        onChange={(next) => {
          value = next;
        }}
      />,
    );
    expect((view.getByLabelText("HTTP headers Value 1") as HTMLInputElement).type).toBe("password");
    expect(
      (
        view.getByLabelText(
          "Headers from environment variables Environment variable name 1",
        ) as HTMLInputElement
      ).type,
    ).toBe("text");
    fireEvent.change(view.getByLabelText("Bearer token environment variable"), {
      target: { value: "MCP_TOKEN" },
    });
    expect(value).toMatchObject({ bearerTokenEnv: "MCP_TOKEN" });
    expect(view.queryByLabelText("Command to launch")).toBeNull();
    view.rerender(
      <McpTransportFields
        value={{
          id: "example",
          name: "Example",
          enabled: false,
          transport: "stdio",
          command: "node",
          args: [],
          env: [],
          envVars: [],
          cwd: "",
        }}
        onChange={(next) => {
          value = next;
        }}
      />,
    );
    expect(view.getByLabelText("Command to launch")).toBeTruthy();
    expect(view.queryByLabelText("URL")).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
