import type { VoiceStatus } from "../../../shared/voice";

export interface VoiceResourceInfoProps {
  statusText?: string;
  error?: string;
  component: NonNullable<VoiceStatus["components"]>[number];
}
