import type { VoiceComposerControl } from "../../hooks/voice-composer-types";

export interface VoiceControlsProps {
  control: VoiceComposerControl;
  running: boolean;
  actions?: HTMLElement | null;
}
