export interface VoiceComponentInstallState {
  phase: "installing" | "completed" | "error" | "cancelled";
  error?: string;
  received: number;
  total: number;
}
