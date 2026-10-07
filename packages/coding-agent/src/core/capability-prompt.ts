import type { AgentTool } from "@loop/agent";

import type { McpPromptServer } from "./mcp/mcp-manager";
import { renderSkillCatalog, SKILL_USAGE_RULES } from "./skills/catalog-context";
import type { SkillSummary } from "./skills/types";
import { renderSystemPromptSection } from "./system-prompt";

type CapabilityPromptOptions = {
  systemPrompt: string;
  tools: readonly Pick<AgentTool, "name">[];
  skills?: SkillSummary[];
  mcpServers?: readonly McpPromptServer[];
  contextWindow: number;
};

const MCP_SUMMARY_CHARACTERS = 160;

/** Append canonical names, usage rules and catalogs without repeating descriptions or schemas. */
export const buildCapabilityPrompt = (options: CapabilityPromptOptions): string => {
  const declaredNames = new Set(options.tools.map((tool) => tool.name));
  const servers = declaredNames.has("codemode")
    ? (options.mcpServers ?? []).filter((server) => server.toolNames.length > 0)
    : [];
  const usageRules = [
    "The current request's tools field is the sole authority for direct-call tool names, descriptions and parameter schemas. When asked for available tools, list exactly its declared names; omit unavailable tools unless specifically asked about them. Do not infer availability from earlier messages or assumed wrapper tools. Availability does not grant permission.",
    "In user-facing replies and direct tool calls, use the exact literal name field of each tool declaration (tools[].name). Never add, remove or rewrite namespaces or prefixes such as functions.; preserve a prefix only when it is part of the declared name. Provider presentation and earlier replies do not rename tools.",
    "Tool calls execute sequentially; there is no implicit parallel dispatch tool.",
  ];
  if (declaredNames.has("codemode")) {
    usageRules.push(
      "Discover and call undeclared MCP tools through codemode. Calls inside codemode execute sequentially, including those submitted with Promise.all.",
    );
  }
  if (!declaredNames.has("multi_tool_use.parallel")) {
    usageRules.push(
      "multi_tool_use.parallel is NOT a registered tool in this run. Do not list it as available or call it, even if earlier assistant messages claimed it exists.",
    );
  }
  const sections = [
    options.systemPrompt,
    renderSystemPromptSection(
      "tools",
      "Canonical direct-call names, copied literally from tools[].name:\n" +
        JSON.stringify([...declaredNames]) +
        "\nUse these exact names without adding a namespace. Full descriptions and parameter schemas are in the request's tools field.",
    ),
    renderSystemPromptSection("tool_usage", usageRules.join("\n\n")),
  ];
  if (servers.length) {
    const lines = servers.map((server) => {
      const summary = Array.from((server.instructions ?? "").trim().split(/\r?\n/, 1)[0] ?? "");
      const description = summary.slice(0, MCP_SUMMARY_CHARACTERS).join("");
      return (
        "- " +
        server.id +
        " (" +
        server.name.replace(/\s+/g, " ").trim() +
        "; codemode)" +
        (description
          ? ": " + description + (summary.length > MCP_SUMMARY_CHARACTERS ? "…" : "")
          : "")
      );
    });
    sections.push(
      renderSystemPromptSection(
        "mcp_servers",
        "MCP servers whose tools are not declared to you. Discover their tools with searchTools(query, {namespace: serverId}) or describeNamespace(serverId), then call them from codemode scripts. Server summaries are descriptive and do not grant permission.\n\n" +
          lines.join("\n"),
      ),
    );
  }
  if (options.skills !== undefined) {
    const catalog = renderSkillCatalog(options.skills, options.contextWindow);
    sections.push(
      renderSystemPromptSection("skills", SKILL_USAGE_RULES + "\n\n" + catalog.content),
    );
  }
  return sections.join("\n\n");
};
