import type { TFunction } from "i18next";

import type { ToolView } from "../../../shared/protocol";

export const toolLabel = (
  tool: ToolView,
  t: TFunction,
): {
  action: "read" | "write" | "edit" | "bash" | "other";
  label: string;
  target: string;
  text: string;
} => {
  const action =
    tool.name === "read" || tool.name === "write" || tool.name === "edit" || tool.name === "bash"
      ? tool.name
      : "other";
  const state = tool.status === "running" || tool.status === "success" ? tool.status : "idle";
  const argument = tool.args?.[action === "bash" ? "command" : "path"];
  if (tool.name === "load_skill") {
    const handle = typeof tool.args?.handle === "string" ? tool.args.handle : "";
    const target = handle.replace(/-[a-f0-9]{24}$/, "") || "skill";
    const label = tool.status === "success" ? t("skills.loaded") : t("skills.loading");
    return { action, label, target, text: `${label} · ${target}` };
  }
  const target =
    action === "other"
      ? (tool.displayName ?? tool.name)
      : typeof argument === "string" && argument.trim()
        ? argument.trim()
        : t(`toolLabels.${action}.target`);
  const label = t(`toolLabels.${action}.${state}`);

  return { action, label, target, text: `${label} ${target}` };
};
