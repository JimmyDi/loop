import type { Api, Context, Model } from "@earendil-works/pi-ai";

import type { ModelInputMetadata } from "@loop/agent";
import { measureContextBudget } from "./context-budget";
import type { ContextBudget } from "./context-budget";
import { projectModelInput } from "./model-input-projection";
import type { ModelInputProjection } from "./model-input-projection";
import type { RuntimeContextSnapshot } from "./runtime-context";
import type { CompactionCheckpoint } from "./context/compaction-checkpoint";

/** Assemble the complete main request before measuring it; never edit history. */
export const assembleModelRequest = (
  model: Model<Api>,
  context: Context,
  snapshots: readonly RuntimeContextSnapshot[],
  metadata: ModelInputMetadata,
  checkpoint?: CompactionCheckpoint,
  reservedOutputTokens = model.maxTokens,
): { context: Context; budget: ContextBudget; projection: ModelInputProjection } => {
  const { messages, projection } = projectModelInput(
    context.messages,
    snapshots,
    metadata,
    checkpoint,
  );
  const request = { ...structuredClone({ ...context, messages: [] }), messages };
  return {
    context: request,
    budget: measureContextBudget(model, request, reservedOutputTokens),
    projection,
  };
};
