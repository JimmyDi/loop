import { join } from "node:path";

import { activationPresent, activationResources, validActivation } from "./resources/activation";
import { sourceVoiceModels } from "./resources/catalog";
import { engineComponent, validateEngineManifest } from "./resources/engine-manifest";
import { importEngineFiles, removeManagedTree } from "./resources/install";
import { installVoiceResources } from "./resources/install-resources";
import { atomicJson, readJson } from "./resources/json-storage";
import { acquireResourceLock } from "./resources/lock";
import { voiceResourceStatus } from "./resources/resource-status";
import type {
  VoiceEngineManifest,
  VoiceResourceStatus,
  VoiceResourceOperationState,
  VoiceResourceInstallOptions,
} from "./resources/resource-types";
import type { VoiceResourceLease } from "./voice-types";

export class VoiceResourceManager {
  readonly directory: string;
  private readonly state: VoiceResourceOperationState = { phase: "idle" };
  private busy = false;
  private leases = 0;

  constructor(agentDir: string) {
    this.directory = join(agentDir, "voice");
  }

  status(): Promise<VoiceResourceStatus> {
    return voiceResourceStatus(this.directory, this.state);
  }

  install(
    options: VoiceResourceInstallOptions = {},
    signal?: AbortSignal,
  ): Promise<VoiceResourceStatus> {
    return this.run("installing", () =>
      installVoiceResources(this.directory, this.state, options, signal),
    ).then(() => this.status());
  }

  update(
    options: VoiceResourceInstallOptions = {},
    signal?: AbortSignal,
  ): Promise<VoiceResourceStatus> {
    return this.install(options, signal);
  }

  uninstall(): Promise<void> {
    return this.run("uninstalling", async () => {
      for (const name of ["active.json", "local-engine.json", "engines", "models", "staging"])
        await removeManagedTree(join(this.directory, name));
    });
  }

  importLocalEngine(source: string, manifest: VoiceEngineManifest): Promise<void> {
    return this.run("installing", async () => {
      const valid = validateEngineManifest(manifest);
      await importEngineFiles(this.directory, engineComponent(valid), source);
      await atomicJson(join(this.directory, "local-engine.json"), valid);
    });
  }

  importLocalModels(source: string): Promise<void> {
    return this.run("installing", async () => {
      for (const component of sourceVoiceModels) {
        try {
          await importEngineFiles(this.directory, component, join(source, component.id));
        } catch (error) {
          if (component.kind === "tts" && (error as NodeJS.ErrnoException).code === "ENOENT")
            continue;
          throw error;
        }
      }
    });
  }

  async acquireRuntime(): Promise<VoiceResourceLease> {
    if (this.busy || this.leases) throw new Error("voice_resources_busy");
    this.leases++;
    let unlock: (() => void) | undefined;
    try {
      unlock = acquireResourceLock(this.directory);
      const active = await readJson(join(this.directory, "active.json"));
      if (!validActivation(active)) throw new Error("voice_resources_not_installed");
      if (!(await activationPresent(this.directory, active, true)))
        throw new Error("voice_resource_integrity_failed");
      let released = false;
      return {
        resources: activationResources(this.directory, active),
        release: () => {
          if (!released) {
            released = true;
            this.leases--;
            unlock?.();
          }
        },
      };
    } catch (error) {
      this.leases--;
      unlock?.();
      throw error;
    }
  }

  private run(phase: VoiceResourceStatus["phase"], action: () => Promise<void>): Promise<void> {
    if (this.busy || this.leases) return Promise.reject(new Error("voice_resources_busy"));
    let unlock: () => void;
    try {
      unlock = acquireResourceLock(this.directory);
    } catch (error) {
      return Promise.reject(error);
    }
    this.busy = true;
    this.state.phase = phase;
    this.state.error = undefined;
    return action()
      .then(
        () => {
          this.state.phase = "idle";
        },
        (error) => {
          this.state.phase = "error";
          this.state.error =
            error instanceof Error && /^voice_[a-z_]+$/.test(error.message)
              ? error.message
              : "voice_resource_operation_failed";
          throw new Error(this.state.error);
        },
      )
      .finally(() => {
        this.busy = false;
        this.state.download = undefined;
        unlock();
      });
  }
}
