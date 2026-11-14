import type { SessionController } from "./session-controller";
import { settledSnapshot } from "./session-model";
import { errorText } from "./http/errors";

export const startPlanExecution = (
  controller: SessionController,
  id: string,
  version: number,
): void => {
  const requestId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  controller.snapshot = {
    ...controller.snapshot,
    operation: "prompt",
    requestId,
    runId,
    commandError: undefined,
    state: { ...controller.snapshot.state, isRunning: true, outcome: "idle" },
  };
  controller.events.publish({ type: "run.accepted", requestId, runId });
  void controller.session.executePlan!(id, version)
    .catch((error) => {
      controller.snapshot.commandError = errorText(error);
    })
    .finally(() => {
      controller.snapshot = settledSnapshot(controller.session, controller.snapshot);
      controller.events.publish({ type: "session.state", snapshot: controller.snapshot });
    });
};
