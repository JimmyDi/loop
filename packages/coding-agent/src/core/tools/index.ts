import type { AgentTool } from "@loop/agent";
import { PermissionPolicy } from "../permissions/policy";
import { createReadTool } from "./read";
import { createBashTool } from "./bash";
import { createEditTool } from "./edit";
import { createWriteTool } from "./write";

export { createReadTool, createBashTool, createEditTool, createWriteTool };

export function createTools(
  cwd: string,
  names: readonly string[] = ["read", "bash", "edit", "write"],
  policy = new PermissionPolicy(cwd),
): AgentTool[] {
  const factories: Record<string, (cwd: string) => AgentTool> = {
    read: createReadTool,
    bash: (cwd) => createBashTool(cwd, policy),
    edit: (cwd) => createEditTool(cwd, policy),
    write: (cwd) => createWriteTool(cwd, policy),
  };

  return [...new Set(names)].map((name) => {
    if (!Object.hasOwn(factories, name)) throw new Error("Unknown tool: " + name);

    return factories[name](cwd);
  });
}
