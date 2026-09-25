import type { AgentTool } from "../../../agent";
import { withFileMutationQueue } from "./file-mutation-queue";
import { resolveToCwd } from "./path-utils";

export function createEditTool(cwd: string): AgentTool {
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
    execute(args, signal) {
      const path = resolveToCwd(String(args.path), cwd);

      return withFileMutationQueue(path, async () => {
        signal.throwIfAborted();

        const original = await Bun.file(path).text();
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
        await Bun.write(path, output);
        signal.throwIfAborted();

        return [{ type: "text", text: "Successfully edited " + String(args.path) }];
      });
    },
  };
}
