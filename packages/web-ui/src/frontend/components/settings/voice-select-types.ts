export interface VoiceSelectOption {
  value: string;
  name: string;
  description?: string;
}

export interface VoiceSelectProps {
  label: string;
  value: string;
  disabled?: boolean;
  options: VoiceSelectOption[];
  onChange(value: string): void;
}
