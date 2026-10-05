import type { PermissionTool } from "../approvals/tool-approvals";
import { approveFileWrite, snapshotFile } from "../permissions/file-approval";
import { PermissionError } from "../permissions/permission-error";
import { PermissionPolicy, rejectEscalation } from "../permissions/policy";
import type { ToolPermissionOptions } from "../permissions/types";
import { writePermittedFile } from "../permissions/write-file";
import { withFileMutationQueue } from "./file-mutation-queue";
import { resolveToCwd } from "./path-utils";

export const createEditTool = (
  cwd: string,
  options: ToolPermissionOptions | PermissionPolicy = {},
): PermissionTool => {
  const policy = options instanceof PermissionPolicy ? options : new PermissionPolicy(cwd, options);
  return {
    name: "edit",
    description:
      "Replace unique, non-overlapping exact text matches in a file. Each edit matches the original file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        edits: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: { oldText: { type: "string", minLength: 1 }, newText: { type: "string" } },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "edits"],
    },
    execute(args, signal, approval) {
      rejectEscalation(args);
      args = structuredClone(args);
      const path = resolveToCwd(String(args.path), cwd);

      return withFileMutationQueue(
        path,
        async () => {
          signal.throwIfAborted();

          const { target, denial } = await policy.inspectWrite(path);
          if (denial && !approval) throw new PermissionError(denial + "; approval is unavailable");
          const before = await snapshotFile(target);
          if (!before.bytes) throw new Error("Edit target does not exist");
          const original = new TextDecoder().decode(before.bytes);
          const edits = (args.edits as Array<{ oldText: string; newText: string }>)
            .map((edit) => {
              const start = original.indexOf(edit.oldText);

              if (start < 0 || original.indexOf(edit.oldText, start + 1) >= 0)
                throw new Error("oldText must match exactly once");

              return { ...edit, start, end: start + edit.oldText.length };
            })
            .sort((a, b) => a.start - b.start);

          for (let index = 1; index < edits.length; index++) {
            if (edits[index].start < edits[index - 1].end) throw new Error("Edits overlap");
          }

          let output = original;

          for (const edit of edits.reverse())
            output = output.slice(0, edit.start) + edit.newText + output.slice(edit.end);

          signal.throwIfAborted();
          const permit = await approveFileWrite(
            policy,
            path,
            target,
            output,
            before,
            signal,
            approval,
          );
          if (!permit && (await policy.checkWrite(path)) !== target)
            throw new Error("Edit target changed");
          await writePermittedFile(policy, path, output, signal, permit);
          signal.throwIfAborted();

          return [{ type: "text", text: "Successfully edited " + String(args.path) }];
        },
        signal,
      );
    },
  };
};
