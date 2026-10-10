import type { Api, Model } from "@earendil-works/pi-ai";

import type { ModelRuntime } from "../model-runtime";
import type { SessionManager } from "../session-manager";
import { prepareSessionCompaction } from "./session-compaction-plan";
import { generateSummary } from "./generate-summary";

/** Build the summary first, then atomically save its boundary without replacing any originals. */
export const compactSession = async (
  manager: SessionManager,
  runtime: ModelRuntime,
  model: Model<Api>,
  signal: AbortSignal,
): Promise<void> => {
  const { history, checkpoints, previous, plan } = prepareSessionCompaction(manager, model);
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(120000)]);
  const result = await generateSummary(runtime, model, plan.messages, bounded, previous?.summary);
  bounded.throwIfAborted();
  await manager.commit(history, undefined, undefined, {
    compactions: [
      ...checkpoints,
      {
        id: crypto.randomUUID(),
        firstKeptMessageIndex: plan.firstKeptMessageIndex,
        historyMessageCount: history.length,
        timestamp: Date.now(),
        provider: model.provider,
        model: model.id,
        ...result,
      },
    ],
  });
};
