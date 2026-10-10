import { expect, test } from "vitest";

import type { SessionSnapshot } from "../../shared/protocol";
import { contextPercentage } from "./context-percentage";

test("reports latest input/window percentage, preserves overflow and rejects missing or stale data", () => {
  const snapshot = {
    model: { provider: "test", id: "model" },
    state: {
      contextBudget: {
        provider: "test",
        model: "model",
        contextWindow: 10000,
        estimatedInputTokens: 5600,
      },
    },
  } as SessionSnapshot;
  expect(contextPercentage(snapshot)).toBe(56);
  snapshot.state.contextBudget!.estimatedInputTokens = 12000;
  expect(contextPercentage(snapshot)).toBe(120);
  snapshot.state.contextBudget!.estimatedInputTokens = 0;
  expect(contextPercentage(snapshot)).toBe(0);
  snapshot.model.id = "other";
  expect(contextPercentage(snapshot)).toBeUndefined();
  snapshot.model.id = "model";
  snapshot.state.contextBudget!.contextWindow = 0;
  expect(contextPercentage(snapshot)).toBeUndefined();
  snapshot.state.contextBudget = undefined;
  expect(contextPercentage(snapshot)).toBeUndefined();
});
