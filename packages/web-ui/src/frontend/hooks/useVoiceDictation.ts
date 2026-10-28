import { useWorkspace } from "../state/workspace-store";
import { useVoiceInputSession } from "./useVoiceInputSession";
import type { VoiceDictationControl } from "./voice-dictation-types";

export const useVoiceDictation = (sessionId: string): VoiceDictationControl =>
  useVoiceInputSession({
    identity: sessionId,
    complete: (text) => {
      if (!text) return;
      const current = useWorkspace.getState().drafts[sessionId] ?? "";
      const draft = current.trim() ? current : "";
      useWorkspace
        .getState()
        .draft(sessionId, draft + (draft && !/\s$/.test(draft) ? " " : "") + text);
    },
  });
