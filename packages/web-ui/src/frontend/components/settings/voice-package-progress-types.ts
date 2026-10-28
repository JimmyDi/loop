export interface VoicePackageProgressProps {
  error?: string;
  label: string;
  loading: boolean;
  complete: boolean;
  failed: boolean;
  received?: number;
  total?: number;
}
