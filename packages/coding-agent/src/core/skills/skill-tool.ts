import type { AgentTool } from "@loop/agent";

import type { SkillManager } from "./skill-manager";

export const createSkillTool = (manager: SkillManager, cwd: string): AgentTool => ({
  name: "load_skill",
  description:
    "Load the full instructions for a skill using its exact handle from the current catalog. Load before following the workflow. References and scripts are read or executed with existing tools only when needed.",
  parameters: {
    type: "object",
    properties: { handle: { type: "string" } },
    required: ["handle"],
    additionalProperties: false,
  },
  execute: async (args, signal) => {
    const skill = await manager.load(cwd, String(args.handle), signal);
    return [{ type: "text", text: skill.content + "\n\nLoaded revision: " + skill.revision }];
  },
});
