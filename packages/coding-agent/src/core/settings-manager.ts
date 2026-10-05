import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { getAgentDir } from "../config";
import type { ModelSelection } from "./types/storage";
import { DEFAULT_PERMISSION_PRESET, isPermissionPreset } from "./permissions/types";
import type { PermissionPreset } from "./permissions/types";

export class SettingsManager {
  private constructor(
    readonly defaultModel?: ModelSelection,
    readonly defaultPermissionPreset: PermissionPreset = DEFAULT_PERMISSION_PRESET,
  ) {}

  static async create(agentDir = getAgentDir()): Promise<SettingsManager> {
    const file = join(agentDir, "settings.json");

    if (!(await existsSync(file))) return new SettingsManager();

    const value = await readFile(file, "utf8").then(JSON.parse);

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !["provider", "model", "permissionPreset"].includes(key)) ||
      ((value.provider !== undefined || value.model !== undefined) &&
        (typeof value.provider !== "string" || typeof value.model !== "string"))
    )
      throw new Error("settings.json must contain provider and model strings");

    if (value.permissionPreset !== undefined && !isPermissionPreset(value.permissionPreset))
      throw new Error("Invalid permission preset in settings.json");
    return new SettingsManager(
      value.provider === undefined ? undefined : { provider: value.provider, id: value.model },
      value.permissionPreset,
    );
  }

  static inMemory(
    defaultModel?: ModelSelection,
    permissionPreset: PermissionPreset = DEFAULT_PERMISSION_PRESET,
  ): SettingsManager {
    if (!isPermissionPreset(permissionPreset)) throw new Error("Invalid permission preset");
    return new SettingsManager(
      defaultModel ? structuredClone(defaultModel) : undefined,
      permissionPreset,
    );
  }
}
