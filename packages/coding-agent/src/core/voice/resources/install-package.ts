import { componentPresent } from "./component-integrity";
import { installComponent } from "./install";
import type { VoiceComponent, VoiceResourceOperationState } from "./resource-types";

export const installVoicePackage = async (
  directory: string,
  component: VoiceComponent,
  published: VoiceComponent | undefined,
  state: VoiceResourceOperationState,
  signal: AbortSignal,
): Promise<void> => {
  const selected = published ?? component;
  const total =
    selected.archive?.bytes ?? selected.files.reduce((sum, file) => sum + file.bytes, 0);
  const previous = state.packages?.[component.id];
  const operation = {
    phase: "installing" as const,
    received: previous?.total === total ? Math.min(total, Math.max(0, previous.received)) : 0,
    total,
  };
  const progress = (received: number) => {
    operation.received = received;
    const packages = Object.values(state.packages!);
    state.download = {
      received: packages.reduce((sum, item) => sum + item.received, 0),
      total: packages.reduce((sum, item) => sum + item.total, 0),
    };
  };
  try {
    signal.throwIfAborted();
    const installed = await componentPresent(directory, component, true);
    if (!installed) {
      state.packages![component.id] = operation;
      if (
        component.kind === "engine" &&
        !component.archive &&
        component.files.some((file) => !file.url)
      )
        throw new Error("voice_engine_integrity_failed");
      if (component.kind !== "engine" && !published)
        throw new Error("voice_resource_asset_unavailable");
      await installComponent(directory, selected, signal, progress);
    }
    signal.throwIfAborted();
    progress(total);
    state.packages![component.id] = { ...operation, phase: "completed" };
  } catch (error) {
    state.packages![component.id] = {
      ...operation,
      phase: signal.aborted ? "cancelled" : "error",
      error: signal.aborted
        ? undefined
        : error instanceof Error && /^voice_[a-z_]+$/.test(error.message)
          ? error.message
          : "voice_resource_operation_failed",
    };
    throw error;
  }
};
