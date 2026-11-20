import type { ModelChoice } from "../../../shared/protocol";

export const supportsImages = (models: ModelChoice[] | undefined, selected: ModelChoice): boolean =>
  (
    models?.find((model) => model.provider === selected.provider && model.id === selected.id) ??
    selected
  ).input?.includes("image") !== false;
