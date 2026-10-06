import { expect, test } from "vitest";
import { Window } from "happy-dom";

import type { ApprovalRequest } from "../../../shared/protocol";
import { ApprovalCard } from "./ApprovalCard";
import { useSessions } from "../../state/session-store";
import { i18n } from "../../i18n/setup";

test("approval shows exact file edits, gates disconnected input and resyncs an uncertain decision without retry", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  const state = useSessions.getState();
  const language = i18n.language;
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, act, cleanup } = await import("@testing-library/react/pure");
  const request: ApprovalRequest = {
    sessionId: "first",
    requestId: "request",
    toolName: "edit",
    toolCallId: "call",
    policy: "ask",
    reason: "Update the requested example file.",
    createdAt: 0,
    expiresAt: null,
    operation: {
      kind: "file-write",
      permissionMode: "danger-full-access",
      workspaceRoot: "/workspace",
      targetPath: "/outside/example.txt",
      beforeSha256: "before",
      afterSha256: "after",
      arguments: {
        path: "../example.txt",
        edits: [{ oldText: "before text", newText: "<script>after text</script>" }],
      },
    },
  };
  const requests: { url: string; body: unknown }[] = [];
  let resolve!: (response: Response) => void;
  globalThis.fetch = ((url, options) => {
    requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as typeof fetch;
  try {
    useSessions.setState({ views: {} });
    const ui = render(<ApprovalCard request={request} connected={false} />);
    expect(ui.getByRole("status").textContent).toBe("Waiting for approval");
    expect(ui.getByText("Allow this operation with danger-full-access permissions:")).toBeTruthy();
    expect(ui.getByText(/Update the requested example file/)).toBeTruthy();
    expect(ui.queryByText(/Expires in/)).toBeNull();
    const details = ui.container.querySelector("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(ui.getByText("Operation details"));
    expect(details.open).toBe(true);
    expect(ui.container.textContent).toContain("/outside/example.txt");
    expect(ui.container.textContent).toContain("before text");
    expect(ui.container.querySelector("script")).toBeNull();
    expect((ui.getByRole("button", { name: "Allow once" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    ui.rerender(<ApprovalCard request={request} connected />);
    fireEvent.click(ui.getByRole("button", { name: "Allow once" }));
    fireEvent.click(ui.getByRole("button", { name: "Deny" }));
    expect(requests).toEqual([
      { url: "/api/sessions/first/approvals/request", body: { decision: "allowed-once" } },
    ]);
    await act(async () => {
      resolve(Response.json({ code: "approval_not_pending", message: "Ended" }, { status: 409 }));
    });
    expect(ui.getByRole("alert").textContent).toContain("already ended");
    expect(useSessions.getState().views.first).toMatchObject({ connected: false, revision: 1 });
    expect(requests).toHaveLength(1);
    const next = {
      ...request,
      sessionId: "second",
      requestId: "next",
      reason: "Print <script>example</script> for the requested check.",
      operation: {
        kind: "shell-unrestricted" as const,
        workspaceRoot: "/workspace",
        arguments: { command: "printf example", timeout: 20 },
        filesystem: "host" as const,
        network: "host" as const,
        environment: "host" as const,
      },
    };
    ui.rerender(<ApprovalCard key="second-next" request={next} connected />);
    expect(ui.getByText("Allow this operation with danger-full-access permissions:")).toBeTruthy();
    expect(ui.getByText("Access to host files, network and environment.")).toBeTruthy();
    expect(ui.container.querySelector("details")!.open).toBe(false);
    expect(ui.container.querySelector("script")).toBeNull();
    expect(ui.container.textContent).toContain("host filesystem, network and environment");
    expect(ui.container.textContent).toContain("printf example");
    fireEvent.click(ui.getByRole("button", { name: "Deny" }));
    await act(async () => {
      resolve(Response.json({}));
    });
    expect(requests.at(-1)).toEqual({
      url: "/api/sessions/second/approvals/next",
      body: { decision: "rejected" },
    });
    expect(useSessions.getState().views.second).toBeUndefined();
    ui.rerender(<ApprovalCard request={next} connected />);
    expect((ui.getByRole("button", { name: "Allow once" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    const workspaceRequest: ApprovalRequest = {
      ...request,
      reason: "需要创建你要求的示例文件。",
      operation: {
        kind: "file-write",
        permissionMode: "workspace-write",
        workspaceRoot: "/workspace",
        targetPath: "/workspace/example.ts",
        beforeSha256: null,
        afterSha256: "after",
        arguments: { path: "example.ts", content: "example" },
      },
    };
    ui.rerender(<ApprovalCard request={workspaceRequest} connected />);
    expect(ui.container.querySelector(".approval-summary")?.textContent).toBe(
      "Allow this operation with workspace-write permissions: 需要创建你要求的示例文件。",
    );
    expect(ui.container.textContent).toContain("The session permission level stays unchanged");
    await act(async () => {
      await i18n.changeLanguage("zh");
    });
    expect(ui.container.querySelector(".approval-summary")?.textContent).toBe(
      "允许本次操作使用 workspace-write 权限: 需要创建你要求的示例文件。",
    );
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    // Older snapshots and custom requests must not invent a permission tier.
    ui.rerender(
      <ApprovalCard
        request={{
          ...request,
          toolName: "mcp_example",
          operation: {
            kind: "mcp-tool",
            workspaceRoot: "/workspace",
            arguments: { value: "test" },
            serverName: "Example MCP",
            toolName: "example",
            transport: "http",
          },
        }}
        connected
      />,
    );
    expect(ui.getByText("Review MCP call:")).toBeTruthy();
    expect(ui.container.textContent).toContain("Example MCP · example · Streamable HTTP");
    expect(ui.container.textContent).toContain("Allow one external MCP tool call");
    expect(ui.container.textContent).not.toContain("one exact file replacement");
    for (const operation of [
      { ...workspaceRequest.operation!, permissionMode: undefined },
      undefined,
    ]) {
      ui.rerender(<ApprovalCard request={{ ...workspaceRequest, operation }} connected />);
      expect(ui.getByText("Allow this operation once:")).toBeTruthy();
    }
  } finally {
    cleanup();
    await i18n.changeLanguage(language);
    useSessions.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("MCP session approval displays its scope and submits only the live request decision", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const responses: unknown[] = [];
  globalThis.fetch = (async (_url, options) => {
    responses.push(JSON.parse(String(options?.body)));
    return Response.json({});
  }) as typeof fetch;
  try {
    const request: ApprovalRequest = {
      sessionId: "session",
      requestId: "mcp-request",
      toolName: "internal-tool",
      toolCallId: "call",
      reason: "MCP call",
      policy: "ask",
      createdAt: 0,
      expiresAt: null,
      allowSession: true,
      operation: {
        kind: "mcp-tool",
        serverName: "Example",
        toolName: "read_file",
        transport: "http",
        workspaceRoot: "/workspace",
        arguments: { path: "example.txt" },
      },
    };
    const view = render(<ApprovalCard request={request} connected={false} />);
    expect(view.getByText("Example · read_file")).toBeTruthy();
    expect(view.getByText(/any arguments/)).toBeTruthy();
    expect(
      view
        .getByRole("button", { name: "Allow this tool for this session" })
        .hasAttribute("disabled"),
    ).toBe(true);
    view.rerender(<ApprovalCard request={request} connected />);
    await act(async () =>
      fireEvent.click(view.getByRole("button", { name: "Allow this tool for this session" })),
    );
    expect(responses).toEqual([{ decision: "allowed-session" }]);
    view.rerender(<ApprovalCard request={{ ...request, allowSession: undefined }} connected />);
    expect(view.queryByRole("button", { name: "Allow this tool for this session" })).toBeNull();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
