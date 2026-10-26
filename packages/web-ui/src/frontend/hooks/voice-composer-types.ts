import type { VoiceControl } from "./voice-hook-types";
import type { PromptControl } from "./prompt-types";

export interface VoiceComposerControl {
  voice: VoiceControl;
  start(mode: "dictation" | "conversation"): void;
  steering: boolean;
  setSteering(value: boolean): void;
  notice: string;
  editTranscript(): void;
  stopTask(): void;
  editing: boolean;
  prompt: PromptControl;
  blocked: boolean;
}
