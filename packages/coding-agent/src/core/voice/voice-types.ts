export type VoiceRuntimeResources = {
  executablePath: string;
  args?: string[];
  configuration: {
    asr: { encoder: string; decoder: string; joiner: string; tokens: string };
    vad: { model: string };
    tts?: {
      model: string;
      voices: string;
      tokens: string;
      dataDir?: string;
      lexicon?: string;
      modelType?: "kokoro";
    };
  };
};

export type VoiceCallMode = "dictation" | "conversation";

export type VoiceCallOptions = {
  mode: VoiceCallMode;
  synthesis?: boolean;
};

export type VoiceEvent = { callId: string } & (
  | { type: "state"; state: "listening" | "closed" }
  | { type: "speech"; active: boolean }
  | { type: "transcript"; text: string; final: boolean }
  | { type: "audio"; samples: Uint8Array; sampleRate: number; requestId: string }
  | { type: "error"; code: string }
);

export type VoiceEventListener = (event: VoiceEvent) => void;

export type VoiceRuntimeOptions = {
  resources: (
    options: VoiceCallOptions,
  ) =>
    | VoiceRuntimeResources
    | VoiceResourceLease
    | Promise<VoiceRuntimeResources | VoiceResourceLease>;
  startupTimeoutMs?: number;
  operationTimeoutMs?: number;
};

export type VoiceResourceLease = {
  resources: VoiceRuntimeResources;
  release: () => void;
};

export type VoiceSynthesisOptions = {
  requestId?: string;
  speaker?: number;
  signal?: AbortSignal;
};
