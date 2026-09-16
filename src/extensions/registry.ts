import type { McpConnector, Skill, Tool } from "./types";

export class ExtensionRegistry {
  private readonly tools = new Map<string, Tool>();
  private readonly skills = new Map<string, Skill>();
  private readonly connectors = new Map<string, McpConnector>();

  registerTool(tool: Tool) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(tool.name)) throw new Error("Invalid tool name: " + tool.name);
    if (this.tools.has(tool.name)) throw new Error("Tool already registered: " + tool.name);
    this.tools.set(tool.name, tool);
  }

  registerSkill(skill: Skill) {
    if (this.skills.has(skill.name)) throw new Error("Skill already registered: " + skill.name);
    this.skills.set(skill.name, skill);
  }

  registerMcp(connector: McpConnector) {
    if (this.connectors.has(connector.name))
      throw new Error("MCP connector already registered: " + connector.name);
    this.connectors.set(connector.name, connector);
  }

  listTools() {
    return [...this.tools.values()];
  }

  listSkills() {
    return [...this.skills.values()];
  }

  listMcp() {
    return [...this.connectors.values()];
  }

  getTool(name: string) {
    return this.tools.get(name);
  }
}
