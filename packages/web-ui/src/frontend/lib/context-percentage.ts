import type { SessionSnapshot } from "../../shared/protocol";

/** Request or restored retained-context estimate; excludes output and unsent drafts. */
export const contextPercentage = (snapshot: SessionSnapshot): number | undefined => {
  const budget = snapshot.state.contextBudget;
  if (
    !budget ||
    budget.provider !== snapshot.model.provider ||
    budget.model !== snapshot.model.id ||
    !Number.isFinite(budget.contextWindow) ||
    budget.contextWindow <= 0 ||
    !Number.isFinite(budget.estimatedInputTokens) ||
    budget.estimatedInputTokens < 0
  )
    return undefined;
  return Math.round((budget.estimatedInputTokens / budget.contextWindow) * 100);
};
