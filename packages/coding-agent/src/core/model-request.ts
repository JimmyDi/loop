import type { Api, Context, Model } from "@earendil-works/pi-ai";

import { measureContextBudget } from "./context-budget";
import type { ContextBudget } from "./context-budget";
import { projectRuntimeContexts } from "./runtime-context";
import type { RuntimeContextSnapshot } from "./runtime-context";

/** Assemble the complete main request before measuring it; never edit history. */
export const assembleModelRequest = (
  model: Model<Api>,
  context: Context,
  snapshots: readonly RuntimeContextSnapshot[],
): { context: Context; budget: ContextBudget } => {
  const request = structuredClone(context);
  request.messages = projectRuntimeContexts(request.messages, snapshots);
  return { context: request, budget: measureContextBudget(model, request) };
};
