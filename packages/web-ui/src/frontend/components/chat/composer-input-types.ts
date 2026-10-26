import type { ReactNode } from "react";

export interface ComposerInputProps {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
  onFiles?(files: File[]): void;
  focusRequest?: number;
  sessionId?: string;
  hideSkills?: boolean;
  action?: ReactNode;
}
