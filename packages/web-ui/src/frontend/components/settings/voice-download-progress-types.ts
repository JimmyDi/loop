import type { VoiceStatus } from "../../../shared/voice";

export interface VoiceDownloadProgressProps {
  download?: VoiceStatus["download"];
  activity?: "installing" | "updating" | "uninstalling";
}
