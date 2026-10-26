export type VoiceMode = "dictation" | "conversation" | "test";

export type VoiceProfile = "input" | "conversation";

export type VoiceStatus = {
  supported: boolean;
  installed: boolean;
  ttsInstalled?: boolean;
  engineAvailable?: boolean;
  localManagement: boolean;
  phase: "idle" | "installing" | "updating" | "uninstalling" | "error";
  version?: string;
  updateAvailable?: boolean;
  directory?: string;
  download?: { received: number; total?: number };
  error?: string;
  components?: Array<{
    id: string;
    name: string;
    kind: "engine" | "asr" | "vad" | "tts";
    installed: boolean;
    downloadBytes: number;
    requiredBytes?: number;
    installedBytes: number;
    license: string;
    version: string;
  }>;
};

export type VoiceInstallCommand = {
  action: "install" | "update" | "cancel" | "uninstall";
  profile: VoiceProfile;
};

export type VoiceConnection = { callId: string; ticket: string; expiresAt: number };

export type VoiceClientEvent =
  | { type: "authenticate"; ticket: string }
  | { type: "configure"; muted: boolean; readingPaused: boolean }
  | { type: "interrupt"; generation: number }
  | { type: "finish" }
  | { type: "speak"; text: string; generation: number }
  | { type: "close" };

export type VoiceServerEvent =
  | { type: "ready"; callId: string }
  | { type: "transcript"; text: string; final: boolean; utteranceId: string }
  | { type: "status"; status: string }
  | { type: "audio"; generation: number; sampleRate: number; format: "wav" }
  | { type: "error"; code: string };
