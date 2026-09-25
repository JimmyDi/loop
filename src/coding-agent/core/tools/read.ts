import type { AgentTool } from "../../../agent";
import { resolveToCwd } from "./path-utils";
import { truncate } from "./truncate";

export function createReadTool(cwd: string): AgentTool {
  return {
    name: "read",
    description: "Read a text file. Offset is 1-based; use offset/limit to read long files.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["path"],
    },
    async execute(args, signal) {
      signal.throwIfAborted();

      const text = await Bun.file(resolveToCwd(String(args.path), cwd)).text();

      signal.throwIfAborted();

      if (text.includes("\0")) throw new Error("read supports text files only");

      const lines = text.split("\n");
      const offset = Number(args.offset ?? 1) - 1;

      if (offset >= lines.length) throw new Error("Offset is beyond end of file");

      const selected = lines
        .slice(offset, args.limit === undefined ? undefined : offset + Number(args.limit))
        .join("\n");
      const output = truncate(selected);
      const note = output !== selected ? "\n[Output truncated; use offset/limit to continue.]" : "";

      return [{ type: "text", text: output + note }];
    },
  };
}
