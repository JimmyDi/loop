export type SessionTitle = {
  text: string;
  source: "fallback" | "model" | "user";
  messageIndices: number[];
  model?: { provider: string; id: string };
};

export type SessionTitleOptions = {
  mode?: "off" | "first-prompt" | "all-prompts";
  model?: { provider: string; id: string };
  maxInputBytes?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export type TitleInput = { index: number; text: string };
