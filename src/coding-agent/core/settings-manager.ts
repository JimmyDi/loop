import { join } from "node:path";

import { getAgentDir } from "../config";
import type { ModelSelection } from "./types/storage";

export class SettingsManager {
  private constructor(readonly defaultModel?: ModelSelection) {}

  static async create(agentDir = getAgentDir()): Promise<SettingsManager> {
    const file = Bun.file(join(agentDir, "settings.json"));

    if (!(await file.exists())) return new SettingsManager();

    const value = await file.json();

    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).some((key) => !["provider", "model"].includes(key)) ||
      typeof value.provider !== "string" ||
      typeof value.model !== "string"
    )
      throw new Error("settings.json must contain provider and model strings");

    return new SettingsManager({ provider: value.provider, id: value.model });
  }

  static inMemory(defaultModel?: ModelSelection): SettingsManager {
    return new SettingsManager(defaultModel ? structuredClone(defaultModel) : undefined);
  }
}
