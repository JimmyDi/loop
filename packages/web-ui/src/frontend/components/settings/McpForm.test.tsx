import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";

import { i18n } from "../../i18n/setup";
import { McpForm } from "./McpForm";
import type { McpServerConfig } from "../../../shared/mcp";

test("Save immediately overlays the form, prevents repeated submission and clears on failure", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const language = i18n.language;
  const pending = Promise.withResolvers<void>();
  const save = vi.fn(() => pending.promise);
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <McpForm
        initial={{
          id: "example",
          name: "Example",
          enabled: true,
          transport: "stdio",
          command: "node",
          args: [],
          env: [],
          envVars: [],
          cwd: "",
        }}
        existing={false}
        save={save}
        onBack={() => {}}
        remove={async () => {}}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Save" }));
    expect(view.container.querySelector(".mcp-form-overlay")).toBeTruthy();
    expect(view.getByRole("status").textContent).toContain("Please wait a moment.");
    expect(view.getByRole("status").textContent).not.toContain("Configuration saved");
    expect(view.container.querySelector("fieldset")!.disabled).toBe(true);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(save).toHaveBeenCalledOnce();
    await act(async () => pending.reject(new Error("Synthetic save failed")));
    expect(view.container.querySelector(".mcp-form-overlay")).toBeNull();
    expect(view.getByText("Synthetic save failed")).toBeTruthy();
    expect((view.getByLabelText("Name") as HTMLInputElement).value).toBe("Example");
    expect(view.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false);
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("forms retain both transport drafts and failed saves, then submit only the selected transport", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const saved: McpServerConfig[] = [];
  let fail = true;
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const view = render(
      <McpForm
        initial={{
          id: "example",
          name: "",
          enabled: true,
          transport: "stdio",
          command: "",
          args: [],
          env: [],
          envVars: [],
          cwd: "",
        }}
        existing={false}
        save={async (value) => {
          saved.push(value);
          if (fail) throw new Error("Synthetic save failed");
        }}
        onBack={() => {}}
        remove={async () => {}}
      />,
    );
    fireEvent.change(view.getByLabelText("Name"), { target: { value: "Example" } });
    expect(view.getByRole("group", { name: "Type" })).toBeTruthy();
    expect(view.getByRole("button", { name: "STDIO" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(view.getByLabelText("Command to launch"), { target: { value: "node" } });
    expect(view.getByLabelText("Environment variables Key 1")).toBeTruthy();
    expect(
      view.getByLabelText("Environment variable passthrough Environment variable name 1"),
    ).toBeTruthy();
    fireEvent.change(view.getByLabelText("Arguments Value 1"), { target: { value: "--version" } });
    expect(view.queryByRole("combobox", { name: "Call permissions" })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Streamable HTTP" }));
    expect(view.getByRole("button", { name: "STDIO" }).getAttribute("aria-pressed")).toBe("false");
    expect(view.getByRole("button", { name: "Streamable HTTP" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(view.getByLabelText("HTTP headers Key 1")).toBeTruthy();
    expect(view.getByLabelText("Headers from environment variables Key 1")).toBeTruthy();
    fireEvent.change(view.getByLabelText("URL"), { target: { value: "https://example.com/mcp" } });
    fireEvent.click(view.getByRole("button", { name: "STDIO" }));
    expect((view.getByLabelText("Command to launch") as HTMLInputElement).value).toBe("node");
    expect((view.getByLabelText("Arguments Value 1") as HTMLInputElement).value).toBe("--version");
    fireEvent.click(view.getByRole("button", { name: "Streamable HTTP" }));
    expect((view.getByLabelText("URL") as HTMLInputElement).value).toBe("https://example.com/mcp");
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(view.getByText("Synthetic save failed")).toBeTruthy();
    expect(saved[0]).toMatchObject({
      name: "Example",
      transport: "http",
      url: "https://example.com/mcp",
    });
    expect(saved[0]).not.toHaveProperty("command");
    expect(saved[0]).not.toHaveProperty("approvalMode");
    expect(saved[0]).not.toHaveProperty("toolPolicies");
    expect(saved[0]).toMatchObject({ headers: [], envHeaders: [] });
    fail = false;
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(view.queryByText("Synthetic save failed")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "STDIO" }));
    fireEvent.click(view.getByRole("button", { name: /Add Arguments/ }));
    fireEvent.change(view.getByLabelText("Environment variables Key 1"), {
      target: { value: "EXAMPLE" },
    });
    fireEvent.change(view.getByLabelText("Environment variables Value 1"), {
      target: { value: "synthetic-value" },
    });
    fireEvent.click(view.getByRole("button", { name: /Add Environment variables/ }));
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(saved.at(-1)).toMatchObject({
      transport: "stdio",
      args: ["--version", ""],
      env: [{ key: "EXAMPLE", value: "synthetic-value" }],
      envVars: [],
    });
    expect((view.getByLabelText("Environment variables Value 1") as HTMLInputElement).value).toBe(
      "",
    );
    await act(async () => fireEvent.submit(view.container.querySelector("form")!));
    expect(saved.at(-1)).toMatchObject({
      env: [{ key: "EXAMPLE", value: "", saved: true }],
    });
    await act(async () => {
      await i18n.changeLanguage("zh");
    });
    expect(view.getByLabelText("名称")).toBeTruthy();
    expect(view.getByRole("group", { name: "类型" })).toBeTruthy();
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test.each(["stdio", "http"] as const)(
  "%s edits submit connection fields without legacy permissions or runtime metadata",
  async (transport) => {
    const window = new Window();
    const previous = { window: globalThis.window, document: globalThis.document };
    Object.assign(globalThis, { window, document: window.document });
    const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
    const language = i18n.language;
    const connection: McpServerConfig =
      transport === "stdio"
        ? {
            id: "example",
            name: "Example",
            enabled: true,
            transport,
            command: "node",
            args: [],
            env: [],
            envVars: [],
            cwd: "",
          }
        : {
            id: "example",
            name: "Example",
            enabled: true,
            transport,
            url: "https://example.com/mcp",
            bearerTokenEnv: "",
            headers: [],
            envHeaders: [],
          };
    const snapshot = {
      ...connection,
      approvalMode: "allow",
      toolPolicies: { example: "disabled" },
      tools: [{ name: "example" }],
      status: "ready",
      toolCount: 1,
      error: "connection_closed",
    };
    const save = vi.fn(async (_value: McpServerConfig) => {});
    try {
      await i18n.changeLanguage("en");
      const view = render(
        <McpForm
          initial={snapshot}
          existing
          save={save}
          onBack={() => {}}
          remove={async () => {}}
        />,
      );
      expect(view.queryByRole("combobox", { name: "Call permissions" })).toBeNull();
      await act(async () => fireEvent.submit(view.container.querySelector("form")!));
      expect(save).toHaveBeenCalledExactlyOnceWith(connection);
    } finally {
      cleanup();
      await i18n.changeLanguage(language);
      Object.assign(globalThis, previous);
      await window.happyDOM.close();
    }
  },
);
