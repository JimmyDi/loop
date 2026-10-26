import type { VoiceRuntimeResources } from "./voice-types";

export type VoiceCommand = { v: 1; id: string } & (
  | { type: "configure"; config: VoiceRuntimeResources["configuration"] }
  | { type: "audio"; samples: string }
  | { type: "end" | "close" }
  | { type: "synthesize"; text: string; speaker?: number }
  | { type: "cancel"; targetId: string }
);

export type VoiceFrame = { v: 1; id: string } & (
  | { type: "ready" | "completed" }
  | { type: "speech"; active: boolean }
  | { type: "transcript"; text: string; final: boolean }
  | { type: "audio"; samples: string; sampleRate: number }
  | { type: "error"; code: string }
);
