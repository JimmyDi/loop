import { join } from "node:path";

import { validActivation } from "./activation";
import {
  publishedVoiceModels,
  VOICE_RESOURCE_VERSION,
  sourceVoiceModels,
  voicePlatform,
} from "./catalog";
import { resolveVoiceEngine } from "./engine-resolution";
import { installVoicePackage } from "./install-package";
import { atomicJson, readJson } from "./json-storage";
import { probeVoiceEngine } from "./probe";
import type { VoiceResourceOperationState, VoiceResourceInstallOptions } from "./resource-types";

export const installVoiceResources = async (
  directory: string,
  state: VoiceResourceOperationState,
  options: VoiceResourceInstallOptions,
  signal?: AbortSignal,
): Promise<void> => {
  const engine = await resolveVoiceEngine(directory, state);
  if (!voicePlatform()) throw new Error("voice_platform_unsupported");
  if (!engine) throw new Error("voice_engine_unavailable");
  const active = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(3_600_000)]);
  active.throwIfAborted();
  const previous = await readJson(join(directory, "active.json"));
  const tts = options.tts === true || (validActivation(previous) && previous.tts);
  state.packages ??= {};
  const results = await Promise.allSettled(
    [engine.component, ...sourceVoiceModels.filter((item) => item.kind !== "tts" || tts)].map(
      (component) =>
        installVoicePackage(
          directory,
          component,
          state.release?.models[component.id] ?? publishedVoiceModels[component.id],
          state,
          active,
        ),
    ),
  );
  active.throwIfAborted();
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  await probeVoiceEngine(directory, engine.component, engine.executable, active);
  active.throwIfAborted();
  await atomicJson(
    join(directory, "active.json"),
    {
      version: 1,
      catalog: VOICE_RESOURCE_VERSION,
      engine,
      models: sourceVoiceModels.filter((item) => item.kind !== "tts" || tts),
      tts,
    },
    active,
  );
};
