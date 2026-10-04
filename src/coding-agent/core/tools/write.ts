import type { AgentTool } from "../../../agent";
import { PermissionPolicy, rejectEscalation } from "../permissions/policy";
import type { ToolPermissionOptions } from "../permissions/types";
import { writePermittedFile } from "../permissions/write-file";
import { withFileMutationQueue } from "./file-mutation-queue";
import { resolveToCwd } from "./path-utils";

export const createWriteTool = (
  cwd: string,
  options: ToolPermissionOptions | PermissionPolicy = {},
): AgentTool => {
  const policy = options instanceof PermissionPolicy ? options : new PermissionPolicy(cwd, options);
  return {
    name: "write",
    description: "Create or replace a text file, creating parent directories.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    execute(args, signal) {
      rejectEscalation(args);
      const path = resolveToCwd(String(args.path), cwd);

      return withFileMutationQueue(path, async () => {
        signal.throwIfAborted();
        await writePermittedFile(policy, path, String(args.content), signal);
        signal.throwIfAborted();

        return [{ type: "text", text: "Successfully wrote to " + String(args.path) }];
      });
    },
  };
};
