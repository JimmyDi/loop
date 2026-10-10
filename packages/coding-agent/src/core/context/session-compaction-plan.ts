import type { Api, Model } from "@earendil-works/pi-ai";

import type { SessionManager } from "../session-manager";
import { projectModelInput } from "../model-input-projection";
import { NothingToCompactError } from "./compaction-error";
import { planCompaction } from "./compaction-plan";

export const recentContextTokens = (model: Model<Api>): number =>
  Math.min(20000, Math.max(256, Math.floor(model.contextWindow * 0.2)));

/** Use the same projected history and retention boundary for availability and execution. */
export const prepareSessionCompaction = (manager: SessionManager, model: Model<Api>) => {
  const history = manager.messages;
  const checkpoints = manager.getCompactions();
  const previous = checkpoints.at(-1);
  const keepTokens = recentContextTokens(model);
  const projected = projectModelInput(history, manager.getRuntimeContexts(), {
    historyMessageCount: history.length,
    sources: history.map((_, messageIndex) => ({ type: "history", messageIndex })),
  });
  return {
    history,
    checkpoints,
    previous,
    plan: planCompaction(history, projected, previous, keepTokens),
  };
};

/** Pure local check: no authentication, model request or storage write. */
export const canCompactSession = (manager: SessionManager, model: Model<Api>): boolean => {
  try {
    prepareSessionCompaction(manager, model);
    return true;
  } catch (error) {
    if (error instanceof NothingToCompactError) return false;
    throw error;
  }
};
