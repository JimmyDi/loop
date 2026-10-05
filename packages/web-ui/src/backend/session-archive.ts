import type { Project } from "../shared/protocol";
import type { LoopBridge } from "./loop";
import type { SessionController } from "./session-controller";
import { HttpError } from "./http/errors";

export const updateArchive = async (
  project: Project,
  ids: string[],
  archived: boolean | "delete" | "delete-session",
  state: {
    loop: LoopBridge;
    instances: Map<string, SessionController>;
    owners: Map<string, string>;
  },
): Promise<void> => {
  const { loop, instances, owners } = state;
  if (typeof archived === "boolean") return loop.archive(project, ids, archived);
  const archivedOnly = archived === "delete";
  const records = await loop.list(project);
  if (
    ids.some(
      (id) => !records.some((record) => record.id === id && (!archivedOnly || record.archived)),
    )
  )
    throw archivedOnly
      ? new HttpError(409, "session_not_archived")
      : new HttpError(404, "session_not_found");
  const active = [...instances.values()].filter(
    (item) => item.workspaceId === project.id && ids.includes(item.session.sessionId),
  );
  await Promise.all(active.map((item) => item.session.cancelTitle()));
  try {
    await loop.deleteSessions(project, ids, archivedOnly);
  } finally {
    const remaining = new Set((await loop.list(project)).map((record) => record.id));
    for (const item of active) {
      if (remaining.has(item.session.sessionId)) continue;
      item.dispose();
      instances.delete(item.session.sessionId);
    }
    for (const id of ids) if (!remaining.has(id)) owners.delete(id);
  }
};
