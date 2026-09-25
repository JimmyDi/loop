import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { AgentTool } from "../../../agent";
import { withFileMutationQueue } from "./file-mutation-queue";
import { resolveToCwd } from "./path-utils";

export function createWriteTool(cwd: string): AgentTool {
  return {
    name: "write",
    description: "Create or replace a text file, creating parent directories.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    execute(args, signal) {
      const path = resolveToCwd(String(args.path), cwd);

      return withFileMutationQueue(path, async () => {
        signal.throwIfAborted();
        await mkdir(dirname(path), { recursive: true });
        signal.throwIfAborted();
        await Bun.write(path, String(args.content));
        signal.throwIfAborted();

        return [{ type: "text", text: "Successfully wrote to " + String(args.path) }];
      });
    },
  };
}
