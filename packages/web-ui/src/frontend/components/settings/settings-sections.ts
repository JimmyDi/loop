export const settingsGroups = [
  { label: "personal", items: ["general", "models", "appearance"] },
  { label: "archived", items: ["archivedChats"] },
] as const;

export type SettingsSection = (typeof settingsGroups)[number]["items"][number];
