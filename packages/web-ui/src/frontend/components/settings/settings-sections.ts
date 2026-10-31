export const settingsGroups = [
  { label: "personal", items: ["general", "models", "appearance", "voice"] },
  { label: "integrations", items: ["mcps", "skills"] },
  { label: "connectivity", items: ["remoteAccess"] },
  { label: "archived", items: ["archivedChats"] },
] as const;

export type SettingsSection = (typeof settingsGroups)[number]["items"][number];
