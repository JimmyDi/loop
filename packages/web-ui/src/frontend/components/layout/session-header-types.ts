import type { Ref } from "react";

import type { SessionSnapshot } from "../../../shared/protocol";

export interface SessionHeaderProps {
  snapshot?: SessionSnapshot;
  actionsRef?: Ref<HTMLDivElement>;
}
