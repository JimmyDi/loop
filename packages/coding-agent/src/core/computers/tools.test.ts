import { expect, test, vi } from "vitest";

import { createComputerTools } from "./tools";
import { ApprovalService } from "../approvals/approval-service";
import type { ComputerProvider } from "./types";
import type { ToolApprovalContext } from "../approvals/tool-approvals";

test("remote tools require approval, bind host identity and reject generation changes", async () => {
  const execute = vi.fn().mockResolvedValue({
    status: "succeeded",
    result: { base64: "aGVsbG8=", mime_type: "image/png", screenshot_id: "screen" },
  });
  let generation = 1;
  const provider = {
    inspect: async () => ({ state: "running", generation }),
    execute,
    acquire: async () => ({ lease_id: "lease" }),
  } as unknown as ComputerProvider;
  const actor = { conversation_id: "chat", agent_id: "agent", execution_id: "run" };
  const [tool] = createComputerTools(
    () => provider,
    () => ({ computerId: "computer", actor }),
    "/workspace",
  );
  const args = { name: "desktop", arguments: { action: "screenshot" } };
  const signal = new AbortController().signal;
  const approval = {
    arguments: args,
    request: vi.fn().mockResolvedValue({ outcome: "rejected" }),
  } as unknown as ToolApprovalContext;
  await expect(tool!.execute(args, signal, approval)).rejects.toThrow("not approved");
  expect(execute).not.toHaveBeenCalled();
  vi.mocked(approval.request).mockResolvedValue({ outcome: "allowed-once" } as never);
  const result = await tool!.execute(args, signal, approval);
  expect(result).toEqual([
    { type: "text", text: JSON.stringify({ mime_type: "image/png", screenshot_id: "screen" }) },
    { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
  ]);
  expect(execute.mock.calls[0]![1].actor).toEqual(actor);
  generation = 2;
  await expect(tool!.execute(args, signal, approval)).rejects.toThrow("generation changed");
  expect(execute).toHaveBeenCalledTimes(1);
});

test("Full access runs Echo computer operations without interactive approval", async () => {
  const events: { type: string; interactive?: boolean }[] = [];
  const service = new ApprovalService(
    "chat",
    () => "never",
    (event) => events.push(event),
    () => true,
  );
  const handler = vi.fn();
  service.registerHandler(handler);
  const execute = vi.fn().mockResolvedValue({ status: "succeeded", result: { text: "done" } });
  const provider = {
    inspect: async () => ({ state: "running", generation: 1 }),
    execute,
  } as unknown as ComputerProvider;
  const [tool] = createComputerTools(
    () => provider,
    () => ({
      computerId: "computer",
      actor: { conversation_id: "chat", agent_id: "agent", execution_id: "run" },
    }),
    "/workspace",
  );
  const args = { name: "read_file", arguments: { path: "test.txt" } };
  const signal = new AbortController().signal;
  const approval = {
    arguments: args,
    request: (
      operation: Parameters<ToolApprovalContext["request"]>[0],
      reason: string,
      operationSignal?: AbortSignal,
      options?: Parameters<ToolApprovalContext["request"]>[3],
    ) =>
      service.request(
        { toolCallId: "call", toolName: "computer_operation", reason, operation },
        { signal: operationSignal, ...options },
      ),
  } as ToolApprovalContext;
  try {
    expect(await tool!.execute(args, signal, approval)).toEqual([
      { type: "text", text: JSON.stringify({ text: "done" }) },
    ]);
    expect(execute).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
    expect(service.pending).toEqual([]);
    expect(events).toMatchObject([
      { type: "approval_requested", interactive: false },
      { type: "approval_resolved" },
    ]);
  } finally {
    service.dispose();
  }
});

test("invalid browser actions never reach the provider or approval prompt", async () => {
  const inspect = vi.fn();
  const execute = vi.fn();
  const approval = {
    arguments: {},
    request: vi.fn(),
  } as unknown as ToolApprovalContext;
  const [tool] = createComputerTools(
    () => ({ inspect, execute }) as unknown as ComputerProvider,
    () => ({
      computerId: "computer",
      actor: { conversation_id: "chat", agent_id: "agent", execution_id: "run" },
    }),
    "/workspace",
  );
  await expect(
    tool!.execute(
      { name: "browser", arguments: { action: "press", key: "space" } },
      new AbortController().signal,
      approval,
    ),
  ).rejects.toThrow("Unsupported browser action");
  expect(inspect).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
  expect(approval.request).not.toHaveBeenCalled();
});
