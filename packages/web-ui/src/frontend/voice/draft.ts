import { useWorkspace } from "../state/workspace-store";
import type { PromptSubmission } from "../hooks/prompt-types";

export const appendVoiceDraft = (sessionId: string, text: string): void => {
  const draft = useWorkspace.getState().drafts[sessionId] ?? "";
  useWorkspace.getState().draft(sessionId, draft + (draft && !/\s$/.test(draft) ? " " : "") + text);
};

export const preserveRejectedVoice = (
  sessionId: string,
  text: string,
  result: PromptSubmission,
): void => {
  if (result === "rejected" || result === "skipped") appendVoiceDraft(sessionId, text);
};
