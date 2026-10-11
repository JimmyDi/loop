import { getModelEfforts } from "@loop/coding-agent";

import type { SessionSnapshot } from "../shared/protocol";
import { projectTools } from "../shared/tool-projection";
import type { SessionPort } from "./loop";

export const sessionModel = (session: SessionPort) => {
  const { provider, id, name } = session.model;
  return {
    provider,
    id,
    name,
    efforts: getModelEfforts(session.model),
    input: [...session.model.input],
  };
};

export const settledSnapshot = (
  session: SessionPort,
  snapshot: SessionSnapshot,
): SessionSnapshot => ({
  ...snapshot,
  state: session.state,
  model: sessionModel(session),
  effort: session.effort,
  operation: session.state.isRunning ? "prompt" : "idle",
  draftIndex: undefined,
  compactionStartedAt: undefined,
  tools: projectTools(session.state.messages),
});
