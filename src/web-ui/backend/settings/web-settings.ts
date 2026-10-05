import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isPermissionPreset, SettingsManager } from "../../../coding-agent/index";
import type { PermissionPreset } from "../../../coding-agent/index";
import type { GeneralSettings } from "../../shared/settings";

/** Defaults for future Web sessions; existing session headers remain authoritative. */
export class WebSettings {
  private readonly file: string;
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly agentDir: string) {
    this.file = join(agentDir, "web-ui", "settings.json");
  }

  async read(): Promise<GeneralSettings> {
    await this.tail;
    let value: unknown;
    try {
      value = await Bun.file(this.file).json();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const defaults = await SettingsManager.create(this.agentDir);
      return { permissionPreset: defaults.defaultPermissionPreset };
    }
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => key !== "permissionPreset") ||
      !("permissionPreset" in value) ||
      !isPermissionPreset(value.permissionPreset)
    )
      throw new Error("Invalid Web permission defaults");
    return { permissionPreset: value.permissionPreset };
  }

  save(permissionPreset: PermissionPreset): Promise<GeneralSettings> {
    if (!isPermissionPreset(permissionPreset))
      return Promise.reject(new Error("Invalid permission preset"));
    const operation = this.tail.then(async () => {
      const settings = { permissionPreset };
      const temporary = this.file + "." + crypto.randomUUID() + ".tmp";
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      try {
        const handle = await open(temporary, "wx", 0o600);
        try {
          await handle.writeFile(JSON.stringify(settings) + "\n");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await rename(temporary, this.file);
        return settings;
      } finally {
        await unlink(temporary).catch(() => {});
      }
    });
    this.tail = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
}
