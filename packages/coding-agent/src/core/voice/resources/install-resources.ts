import { join } from "node:path";

import { validActivation } from "./activation";
import {
  publishedVoiceModels,
  VOICE_RESOURCE_VERSION,
  sourceVoiceModels,
  voicePlatform,
} from "./catalog";
import { componentPresent } from "./component-integrity";
import { resolveVoiceEngine } from "./engine-resolution";
import { installComponent } from "./install";
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
  for (const component of [
    engine.component,
    ...sourceVoiceModels.filter((item) => item.kind !== "tts" || tts),
  ]) {
    active.throwIfAborted();
    if (
      component.kind === "engine" &&
      !component.archive &&
      component.files.some((file) => !file.url)
    ) {
      if (!(await componentPresent(directory, component, true)))
        throw new Error("voice_engine_integrity_failed");
      continue;
    }
    const installed = await componentPresent(directory, component, true);
    const published = publishedVoiceModels[component.id];
    if (!installed && component.kind !== "engine" && !published)
      throw new Error("voice_resource_asset_unavailable");
    if (installed) continue;
    await installComponent(directory, published ?? component, active, (received, total) => {
      state.download = { componentId: component.id, received, total };
    });
  }
  active.throwIfAborted();
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
