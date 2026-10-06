import type { SessionSnapshot } from "../../shared/protocol";
import { command } from "./api";

export const createProjectDraft = async (workspaceId: string, previous: SessionSnapshot) => {
  let next = await command<SessionSnapshot>("/sessions", { workspaceId });
  if (
    next.model.provider !== previous.model.provider ||
    next.model.id !== previous.model.id ||
    next.effort !== previous.effort
  ) {
    next = await command<SessionSnapshot>(
      "/sessions/" + next.sessionId + "/model",
      {
        provider: previous.model.provider,
        id: previous.model.id,
        effort: previous.effort,
      },
      "PUT",
    );
  }
  if (
    previous.state.permissionPreset &&
    next.state.permissionPreset !== previous.state.permissionPreset
  ) {
    next = await command<SessionSnapshot>(
      "/sessions/" + next.sessionId + "/permission",
      {
        preset: previous.state.permissionPreset,
      },
      "PUT",
    );
  }
  return next;
};
