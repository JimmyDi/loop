import type { PromptFile } from "../../shared/prompt-files";
import type { PromptImage } from "../../shared/prompt-images";

import type { PromptForm } from "../../shared/prompt-form";

export type PromptSubmission = "accepted" | "rejected" | "uncertain" | "skipped";

export interface PromptTextInput {
  text: string;
  steering: boolean;
  form?: PromptForm;
}

export interface PromptControl {
  submitted: boolean;
  text: string;
  images: PromptImage[];
  files: PromptFile[];
  setText(value: string): void;
  submit(retry?: boolean): Promise<void>;
  submitText(value: string, steering?: boolean, form?: PromptForm): Promise<PromptSubmission>;
  pending: boolean;
  error: unknown;
  uncertain: boolean;
}
