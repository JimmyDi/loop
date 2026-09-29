import type { TFunction } from "i18next";

import type { ToolView } from "../../../shared/protocol";

/** Describe observed tool actions without inferring intent or execution results. */
export const toolActionSummary = (tools: readonly ToolView[], t: TFunction): string => {
  const counts = new Map<string, number>();
  for (const tool of tools) counts.set(tool.name, (counts.get(tool.name) ?? 0) + 1);

  const actions = [...counts].map(([name, count]) => {
    if (name === "read" || name === "write" || name === "edit" || name === "bash") {
      return counts.size === 1
        ? t(`toolActionCounts.${name}`, { count })
        : t(`toolActions.${name}`);
    }
    return name ? t("toolActions.named", { name }) : t("toolActions.other");
  });

  if (actions.length < 2) return actions[0] ?? "";
  return t("toolActions.combined", {
    first: actions.slice(0, -1).join(t("toolActions.separator")),
    last: actions.at(-1),
  });
};
