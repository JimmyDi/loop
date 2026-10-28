import type { ReactNode } from "react";

export interface VoiceSetupStepProps {
  className?: string;
  number: number;
  title: string;
  complete: boolean;
  loading?: boolean;
  failed?: boolean;
  actions?: ReactNode;
  progress?: ReactNode;
  issue?: string;
  children?: ReactNode;
}
