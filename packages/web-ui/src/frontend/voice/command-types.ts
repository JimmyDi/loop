export type SpokenCommand =
  | { action: "abort" }
  | { action: "resume" }
  | { action: "prompt"; text: string; steering: boolean }
  | { action: "empty" };
