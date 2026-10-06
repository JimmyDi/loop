import type { TFunction } from "i18next";

import type { ToolView } from "../../../shared/protocol";

/** Summarize completed actions; failed calls never count as successful work. */
export const toolActionSummary = (tools: readonly ToolView[], t: TFunction): string => {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    if (tool.status === "success") counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);
  }

  const actions = [...counts].map(([name, count]) => {
    if (name === "read" || name === "write" || name === "edit" || name === "bash") {
      return counts.size === 1
        ? t(`toolCompletedCounts.${name}`, { count })
        : t(`toolCompletedActions.${name}`);
    }
    return name ? t("toolCompletedActions.named", { name }) : t("toolCompletedActions.other");
  });
  const failed = tools.filter((tool) => tool.status === "error").length;
  if (failed) actions.push(t("toolCompletedCounts.failed", { count: failed }));

  if (actions.length < 2) return actions[0] ?? "";
  return t("toolActions.combined", {
    first: actions.slice(0, -1).join(t("toolActions.separator")),
    last: actions.at(-1),
  });
};
