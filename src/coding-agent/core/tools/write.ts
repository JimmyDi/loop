import type { PermissionTool } from "../approvals/tool-approvals";
import { approveFileWrite, snapshotFile } from "../permissions/file-approval";
import { PermissionPolicy, validateFilePermissionArguments } from "../permissions/policy";
import type { ToolPermissionOptions } from "../permissions/types";
import { writePermittedFile } from "../permissions/write-file";
import { withFileMutationQueue } from "./file-mutation-queue";
import { resolveToCwd } from "./path-utils";

export const createWriteTool = (
  cwd: string,
  options: ToolPermissionOptions | PermissionPolicy = {},
): PermissionTool => {
  const policy = options instanceof PermissionPolicy ? options : new PermissionPolicy(cwd, options);
  return {
    name: "write",
    description: "Create or replace a text file, creating parent directories.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        justification: {
          type: "string",
          minLength: 1,
          maxLength: 240,
          description:
            "For approval, briefly explain this file change in one sentence in the user's language. This explanation does not grant permissions.",
        },
      },
      required: ["path", "content"],
    },
    execute(args, signal, approval) {
      validateFilePermissionArguments(args);
      args = structuredClone(args);
      const path = resolveToCwd(String(args.path), cwd);

      return withFileMutationQueue(
        path,
        async () => {
          signal.throwIfAborted();
          const { target, denial } = await policy.inspectWrite(path);
          const content = String(args.content);
          const permit = denial
            ? await approveFileWrite(
                policy,
                path,
                target,
                content,
                await snapshotFile(target),
                signal,
                approval,
              )
            : undefined;
          await writePermittedFile(policy, path, content, signal, permit);
          signal.throwIfAborted();

          return [{ type: "text", text: "Successfully wrote to " + String(args.path) }];
        },
        signal,
      );
    },
  };
};
