import { join } from "node:path";

import { validActivation, activationPresent, activationChanged } from "./activation";
import {
  publishedVoiceModels,
  VOICE_ENGINE_LICENSE,
  VOICE_RESOURCE_VERSION,
  sourceVoiceModels,
  voicePlatform,
} from "./catalog";
import { componentPresent } from "./component-integrity";
import { resolveVoiceEngine } from "./engine-resolution";
import { readJson } from "./json-storage";
import type {
  VoiceComponent,
  VoiceResourceStatus,
  VoiceResourceOperationState,
} from "./resource-types";

export const voiceResourceStatus = async (
  directory: string,
  state: VoiceResourceOperationState,
): Promise<VoiceResourceStatus> => {
  const engine = await resolveVoiceEngine(directory, state);
  const definitions: VoiceComponent[] = [
    ...(engine
      ? [engine.component]
      : [
          {
            id: "loop-voice-" + (voicePlatform() ?? "unsupported"),
            name: "Loop local voice engine",
            kind: "engine" as const,
            version: "1.0.0",
            license: VOICE_ENGINE_LICENSE,
            files: [],
          },
        ]),
    ...sourceVoiceModels,
  ];
  const components = await Promise.all(
    definitions.map(async (component) => {
      const installed = !!component.files.length && (await componentPresent(directory, component));
      const bytes = component.files.reduce((sum, file) => sum + file.bytes, 0);
      const { files: _files, archive: _archive, ...metadata } = component;
      return {
        ...metadata,
        installed,
        downloadBytes:
          (component.kind === "engine" ? component : publishedVoiceModels[component.id])?.archive
            ?.bytes ?? bytes,
        requiredBytes: bytes,
        installedBytes: installed ? bytes : 0,
      };
    }),
  );
  const activation = await readJson(join(directory, "active.json"));
  const active = validActivation(activation) ? activation : undefined;
  const installed = !!active && (await activationPresent(directory, active));
  if (installed && state.phase === "error" && state.error === "voice_engine_unavailable") {
    state.phase = "idle";
    state.error = undefined;
  }
  return {
    supported: !!voicePlatform(),
    installed,
    ttsInstalled: installed && active?.tts === true,
    engineAvailable: !!engine,
    directory: directory,
    version: VOICE_RESOURCE_VERSION,
    updateAvailable:
      !!active &&
      !!engine &&
      (active.catalog !== VOICE_RESOURCE_VERSION ||
        activationChanged(active, engine.component, sourceVoiceModels)),
    phase: state.phase,
    components,
    download: state.download,
    error: state.error,
  };
};
