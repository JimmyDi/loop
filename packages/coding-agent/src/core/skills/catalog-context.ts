import { estimateTextTokens } from "../context-budget";
import { renderSystemPromptSection } from "../system-prompt";
import type { SkillSummary } from "./types";

export const SKILL_USAGE_RULES =
  "Skills provide task-specific workflows, not permissions. The current system-prompt skill catalog is authoritative for new loads; older catalogs in conversation history may be stale. When a task clearly matches a description, call load_skill with its exact handle before following the workflow. Load references and run scripts only when needed. Follow existing tool permissions. Explicitly loaded instructions need not be loaded again in this turn.";

const estimateCatalogTokens = (text: string): number =>
  estimateTextTokens(renderSystemPromptSection("skills", text));

export const renderSkillCatalog = (skills: SkillSummary[], contextWindow: number) => {
  const available = skills.filter((skill) => skill.enabled && !skill.error && skill.modelInvocable);
  const budget = Math.max(64, Math.min(2000, Math.floor(contextWindow * 0.02)));
  const heading = "Available skills (host-provided). Use only these handles for new loads:\n";
  let text = heading;
  let omitted = 0;
  for (const skill of available) {
    let description = skill.description;
    const prefix = "- " + skill.handle + " (" + skill.name + ", " + skill.scope + "): ";
    let line = prefix + description + "\n";
    while (description.length > 32 && estimateCatalogTokens(text + line) > budget - 24) {
      description = description.slice(0, Math.floor(description.length * 0.7));
      line = prefix + description + "…\n";
    }
    if (estimateCatalogTokens(text + line) > budget - 24) {
      omitted++;
      continue;
    }
    text += line;
  }
  if (!available.length) text += "No skills are currently available for automatic selection.\n";
  if (omitted) text += omitted + " skills omitted; select them explicitly.\n";
  return { content: text.trim(), omitted };
};
