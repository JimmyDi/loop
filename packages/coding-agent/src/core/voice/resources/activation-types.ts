import type { VoiceComponent } from "./resource-types";
import type { VoiceEngineSelection } from "./resource-types";

export type VoiceActivation = {
  version: 1;
  catalog: string;
  engine: VoiceEngineSelection;
  models: VoiceComponent[];
  tts: boolean;
};
