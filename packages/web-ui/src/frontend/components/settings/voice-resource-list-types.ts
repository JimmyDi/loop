import type { VoiceStatus } from "../../../shared/voice";

export interface VoiceResourceListProps {
  statusText?: string;
  components: VoiceStatus["components"];
}
