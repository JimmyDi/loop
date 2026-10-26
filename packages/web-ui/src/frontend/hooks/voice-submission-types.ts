import type { SessionSnapshot } from "../../shared/protocol";
import type { VoiceControl } from "./voice-hook-types";
import type { PromptControl } from "./prompt-types";

export interface VoiceQueuedSubmission {
  text: string;
  steering: boolean;
  id: string;
}

export interface VoiceSubmissionOptions {
  snapshot: SessionSnapshot;
  connected: boolean;
  editing: boolean;
  voice: VoiceControl;
  prompt: Pick<PromptControl, "pending" | "uncertain" | "submitText">;
  notice(value: string): void;
}

export interface VoiceSubmissionControl {
  clear(): void;
  remove(id: string): void;
  enqueue(item: VoiceQueuedSubmission): void;
}
