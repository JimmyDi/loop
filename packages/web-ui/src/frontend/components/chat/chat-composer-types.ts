import type { SessionSnapshot } from "../../../shared/protocol";

export interface ChatComposerProps {
  snapshot: SessionSnapshot;
  connected: boolean;
}
