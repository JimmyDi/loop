import type { AgentTool } from "../../../agent";
import { createReadTool } from "./read";
import { createBashTool } from "./bash";
import { createEditTool } from "./edit";
import { createWriteTool } from "./write";

export { createReadTool, createBashTool, createEditTool, createWriteTool };

export function createTools(
  cwd: string,
  names: readonly string[] = ["read", "bash", "edit", "write"],
): AgentTool[] {
  const factories: Record<string, (cwd: string) => AgentTool> = {
    read: createReadTool,
    bash: createBashTool,
    edit: createEditTool,
    write: createWriteTool,
  };

  return [...new Set(names)].map((name) => {
    if (!Object.hasOwn(factories, name)) throw new Error("Unknown tool: " + name);

    return factories[name](cwd);
  });
}
