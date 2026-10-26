import type { PromptFile } from "../../shared/prompt-files";
import type { PromptImage } from "../../shared/prompt-images";

export type PromptSubmission = "accepted" | "rejected" | "uncertain" | "skipped";

export interface PromptVoiceInput {
  text: string;
  steering: boolean;
}

export interface PromptControl {
  submitted: boolean;
  text: string;
  images: PromptImage[];
  files: PromptFile[];
  setText(value: string): void;
  submit(retry?: boolean): Promise<void>;
  submitText(value: string, steering?: boolean): Promise<PromptSubmission>;
  pending: boolean;
  error: unknown;
  uncertain: boolean;
}
