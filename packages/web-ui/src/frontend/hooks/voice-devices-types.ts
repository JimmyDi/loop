export interface VoiceDevicesControl {
  devices: MediaDeviceInfo[];
  selected: string;
  select(id: string): void;
}
