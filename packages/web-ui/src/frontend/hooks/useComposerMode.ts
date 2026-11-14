import type { SessionSnapshot } from "../../shared/protocol";

import { useSessionPlanning } from "./useSessionPlanning";
import { useSessionPermission } from "./useSessionPermission";

export const useComposerMode = (snapshot: SessionSnapshot) => ({
  permission: useSessionPermission(snapshot),
  planning: useSessionPlanning(snapshot),
});
