import { join } from "node:path";

import type { VoiceRuntimeResources } from "../voice-types";
import type { VoiceActivation } from "./activation-types";
import { componentPresent } from "./component-integrity";
import { componentDirectory, componentHash, safeResourcePath } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const validActivation = (value: unknown): value is VoiceActivation => {
  if (!value || typeof value !== "object") return false;
  const active = value as VoiceActivation;
  const component = (item: VoiceComponent) =>
    !!item &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    /^[a-zA-Z0-9_-]+$/.test(item.id) &&
    typeof item.version === "string" &&
    /^[a-zA-Z0-9_.-]+$/.test(item.version) &&
    ["engine", "asr", "vad", "tts"].includes(item.kind) &&
    Array.isArray(item.files) &&
    item.files.length > 0 &&
    item.files.length <= 64 &&
    item.files.every(
      (file) =>
        !!file &&
        safeResourcePath(file.path) &&
        (/^[a-zA-Z0-9_.-]+$/.test(file.path) ||
          /^(lib|licenses)\/[a-zA-Z0-9_.-]+$/.test(file.path)),
    ) &&
    item.files.every(
      (file) =>
        Number.isSafeInteger(file.bytes) && file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256),
    ) &&
    new Set(item.files.map((file) => file.path)).size === item.files.length;
  return (
    active.version === 1 &&
    typeof active.catalog === "string" &&
    typeof active.tts === "boolean" &&
    !!active.engine &&
    typeof active.engine === "object" &&
    component(active.engine.component) &&
    active.engine.component.kind === "engine" &&
    safeResourcePath(active.engine.executable) &&
    /^[a-zA-Z0-9_.-]+$/.test(active.engine.executable) &&
    active.engine.component.files.some((file) => file.path === active.engine.executable) &&
    Array.isArray(active.models) &&
    active.models.length >= 2 &&
    active.models.length <= 3 &&
    active.models.every(component) &&
    new Set(active.models.map((item) => item.kind)).size === active.models.length &&
    new Set(active.models.map((item) => item.id)).size === active.models.length &&
    active.models.some((item) => item.kind === "asr") &&
    active.models.some((item) => item.kind === "vad") &&
    (!active.tts || active.models.some((item) => item.kind === "tts"))
  );
};

export const activationPresent = async (
  root: string,
  active: VoiceActivation,
  verify = false,
): Promise<boolean> => {
  for (const component of [active.engine.component, ...active.models])
    if (!(await componentPresent(root, component, verify))) return false;
  return true;
};

export const activationResources = (
  root: string,
  active: VoiceActivation,
): VoiceRuntimeResources => {
  const directory = (kind: VoiceComponent["kind"]) => {
    const component = active.models.find((item) => item.kind === kind);
    if (!component) throw new Error("voice_resource_manifest_invalid");
    return componentDirectory(root, component);
  };
  const asr = directory("asr"),
    vad = directory("vad"),
    tts = active.tts ? directory("tts") : "";
  return {
    executablePath: join(
      componentDirectory(root, active.engine.component),
      active.engine.executable,
    ),
    configuration: {
      asr: {
        encoder: join(asr, "encoder-epoch-99-avg-1.int8.onnx"),
        decoder: join(asr, "decoder-epoch-99-avg-1.int8.onnx"),
        joiner: join(asr, "joiner-epoch-99-avg-1.int8.onnx"),
        tokens: join(asr, "tokens.txt"),
      },
      vad: { model: join(vad, "silero_vad.int8.onnx") },
      ...(active.tts
        ? {
            tts: {
              model: join(tts, "model.int8.onnx"),
              voices: join(tts, "voices.bin"),
              tokens: join(tts, "tokens.txt"),
              lexicon: join(tts, "lexicon-us-en.txt") + "," + join(tts, "lexicon-zh.txt"),
              modelType: "kokoro" as const,
            },
          }
        : {}),
    },
  };
};

export const activationChanged = (
  active: VoiceActivation,
  engine: VoiceComponent,
  models: readonly VoiceComponent[],
): boolean =>
  componentHash(active.engine.component) !== componentHash(engine) ||
  models.some((item) => {
    const previous = active.models.find((model) => model.id === item.id);
    return (
      (!previous && item.kind !== "tts") ||
      (!!previous && componentHash(previous) !== componentHash(item))
    );
  });
