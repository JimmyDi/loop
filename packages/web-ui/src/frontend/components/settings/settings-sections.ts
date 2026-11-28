import { environment } from "../../lib/environment";

export const settingsGroups = [
  {
    label: "personal",
    items: [
      "general",
      "models",
      "appearance",
      "voice",
      ...(environment === "local-dev" ? (["debug"] as const) : []),
    ],
  },
  { label: "integrations", items: ["mcps", "skills"] },
  { label: "connectivity", items: ["remoteAccess"] },
  { label: "archived", items: ["archivedChats"] },
] as const;

export type SettingsSection = (typeof settingsGroups)[number]["items"][number];
