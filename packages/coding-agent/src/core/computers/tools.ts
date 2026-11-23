import { randomUUID } from "node:crypto";

import type { PermissionTool } from "../approvals/tool-approvals";
import type { ComputerActor, ComputerProvider } from "./types";
import { computerOperationArguments } from "./operation-arguments";

export const createComputerTools = (
  provider: () => ComputerProvider,
  binding: () => { computerId: string; actor: ComputerActor },
  workspaceRoot: string,
  onLease?: (client: ComputerProvider, computerId: string, leaseId: string) => void,
): PermissionTool[] => {
  let execution: string | undefined;
  let generation: number | undefined;
  const lifetime = new AbortController().signal;
  return [
    {
      name: "computer_operation",
      description:
        "Operate the shared remote computer. Paths are remote /workspace paths. exec starts a process; poll get_process. Browser actions are open, set_content, snapshot, click, fill, screenshot. Browser press, type, reload and evaluate are unsupported. Desktop actions are screenshot, click, type, keypress, scroll. Take a fresh desktop screenshot before each input and pass its screenshot_id. Use keypress with an X11 key name such as space or Return. Never replay an unknown outcome.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: [
              "exec",
              "get_process",
              "cancel_process",
              "read_file",
              "write_file",
              "edit_file",
              "list_files",
              "upload_file",
              "browser",
              "desktop",
            ],
          },
          arguments: {
            type: "object",
            additionalProperties: true,
            description:
              "exec: command,cwd?,timeout?; processes: process_id,cursor?; files: path,content or old_text,new_text; upload: path,base64; browser: action=open|set_content|snapshot|click|fill|screenshot, url/selector/text; desktop: action=screenshot|click|type|keypress|scroll, screenshot_id for input, x,y,text,key,direction,amount. Browser keyboard shortcuts use desktop keypress.",
          },
        },
        required: ["name", "arguments"],
        additionalProperties: false,
      },
      execute: async (args, signal, approval) => {
        if (!approval) throw new Error("Computer approval context unavailable");
        const context = binding();
        const name = String(args.name);
        const operationArguments = computerOperationArguments(name, args.arguments);
        const decision = await approval.request(
          {
            kind: "mcp-tool",
            transport: "http",
            workspaceRoot,
            serverName: "Echo computer",
            toolName: name,
            arguments: approval.arguments,
          },
          "Run " + name + " on the remote computer",
          signal,
          { mcp: { lifetime, toolKey: context.computerId + "/" + name } },
        );
        if (decision.outcome !== "allowed-once" && decision.outcome !== "allowed-session")
          throw new Error("Computer operation was not approved");
        signal.throwIfAborted();
        const client = provider();
        const computer = await client.inspect(context.computerId, signal);
        if (computer.state !== "running")
          throw new Error("Start the computer before running tools");
        if (execution !== context.actor.execution_id) {
          execution = context.actor.execution_id;
          generation = computer.generation;
        }
        if (generation !== computer.generation)
          throw new Error("Computer generation changed during execution; start a new turn");
        const requestId = randomUUID();
        const lease = ["desktop", "browser"].includes(name)
          ? await client.acquire(context.computerId, context.actor.execution_id, signal)
          : undefined;
        if (lease) onLease?.(client, context.computerId, lease.lease_id);
        try {
          const result = await client.execute(
            context.computerId,
            {
              request_id: requestId,
              generation: computer.generation,
              actor: context.actor,
              name,
              arguments: operationArguments,
              lease_id: lease?.lease_id,
            },
            signal,
          );
          if (result.status !== "succeeded")
            throw new Error(
              "Computer operation " +
                result.status +
                "; query request " +
                requestId +
                " before deciding what to do next.",
            );
          const data = result.result ?? {};
          if (typeof data.base64 === "string" && data.mime_type === "image/png") {
            const { base64, ...metadata } = data;
            return [
              { type: "text", text: JSON.stringify(metadata) },
              { type: "image", data: base64, mimeType: "image/png" },
            ];
          }
          return [{ type: "text", text: JSON.stringify(data) }];
        } catch (error) {
          throw new Error(
            (error instanceof Error ? error.message : "Computer operation failed") +
              " Request ID: " +
              requestId,
          );
        }
      },
    },
    {
      name: "computer_operation_status",
      description: "Query an existing request without re-executing it.",
      parameters: {
        type: "object",
        properties: { request_id: { type: "string" } },
        required: ["request_id"],
        additionalProperties: false,
      },
      execute: async (args, signal, approval) => {
        if (!approval) throw new Error("Computer approval context unavailable");
        const context = binding();
        const decision = await approval.request(
          {
            kind: "mcp-tool",
            transport: "http",
            workspaceRoot,
            serverName: "Echo computer",
            toolName: "operation_status",
            arguments: approval.arguments,
          },
          "Query a remote operation",
          signal,
          { mcp: { lifetime, toolKey: context.computerId + "/operation_status" } },
        );
        if (decision.outcome !== "allowed-once" && decision.outcome !== "allowed-session")
          throw new Error("Computer operation was not approved");
        return [
          {
            type: "text",
            text: JSON.stringify(
              await provider().status(context.computerId, String(args.request_id), signal),
            ),
          },
        ];
      },
    },
  ];
};
