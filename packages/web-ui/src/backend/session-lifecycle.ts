import type { SessionController } from "./session-controller";
import { HttpError } from "./http/errors";

export const assertProjectIdle = (
  pending: number | undefined,
  sessions: SessionController[],
): void => {
  if (pending || sessions.some((item) => item.busy)) throw new HttpError(409, "project_busy");
};

export const closeSessions = async (sessions: Iterable<SessionController>): Promise<void> => {
  const results = await Promise.allSettled([...sessions].map((item) => item.close()));
  const failures = results.filter((item) => item.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((item) => item.reason),
      "Session save failed",
    );
};

export const disposeSessions = async (sessions: SessionController[]): Promise<void> => {
  await cancelTitles(sessions);
  for (const item of sessions) item.dispose();
};

export const cancelTitles = async (sessions: Iterable<SessionController>): Promise<void> => {
  await Promise.all([...sessions].map((item) => item.session.cancelTitle()));
};

export const forgetProject = (
  id: string,
  instances: Map<string, SessionController>,
  owners: Map<string, string>,
): void => {
  for (const [sessionId, owner] of owners) {
    if (owner !== id) continue;
    instances.delete(sessionId);
    owners.delete(sessionId);
  }
};
