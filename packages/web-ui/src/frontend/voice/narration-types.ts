export interface VoiceNarrationRow {
  id: string;
  kind: "reply" | "details" | "toolStart" | "toolEnd" | "toolError" | "approval";
  text: string;
}
