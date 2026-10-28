import type { ReactNode } from "react";

import type { VoiceComposerControl } from "../../hooks/voice-composer-types";

export interface ComposerSubmitActionsProps {
  control: VoiceComposerControl;
  children: ReactNode;
}
