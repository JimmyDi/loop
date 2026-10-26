import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../shared/protocol";
import { useVoice } from "./useVoice";
import { usePrompt } from "./usePrompt";
import { useWorkspace } from "../state/workspace-store";
import { useQueueEdits } from "../state/queue-edit-store";
import { parseSpokenCommand } from "../voice/commands";
import { useVoiceNarration } from "./useVoiceNarration";
import { command } from "../lib/api";
import { appendVoiceDraft } from "../voice/draft";
import { useVoiceSubmission } from "./useVoiceSubmission";
import type { VoiceComposerControl } from "./voice-composer-types";
import { useVoiceSetup } from "./useVoiceSetup";

export const useVoiceComposer = (
  snapshot: SessionSnapshot,
  connected: boolean,
  hasProject: boolean,
): VoiceComposerControl => {
  const { t } = useTranslation();
  const prompt = usePrompt(snapshot, hasProject);
  const setup = useVoiceSetup();
  const editing = useQueueEdits((state) => !!state.edits[snapshot.sessionId]);
  const [steering, setSteering] = useState(false);
  const [notice, setNotice] = useState("");
  const base = useRef("");
  const latest = useRef({ snapshot, connected, editing, hasProject, steering });
  const owner = useRef(snapshot.sessionId);
  const utterance = useRef("");
  latest.current = { snapshot, connected, editing, hasProject, steering };
  const voice = useVoice({
    sessionId: snapshot.sessionId,
    transcript: (text, final, _id, mode) => {
      if (owner.current !== snapshot.sessionId) return;
      if (mode === "dictation") {
        const next = base.current + text;
        useWorkspace.getState().draft(snapshot.sessionId, next);
        if (final) base.current = next + (text ? " " : "");
        return;
      }
      const current = latest.current;
      utterance.current = _id;
      if (!final || !text.trim() || current.editing || !current.connected || !current.hasProject)
        return;
      const spoken = parseSpokenCommand(text, current.steering);
      if (spoken.action === "empty") {
        setNotice(t("voice.emptyCorrection"));
        return;
      }
      if (spoken.action === "abort" || spoken.action === "resume") {
        if (spoken.action === "abort") {
          submission.clear();
        }
        if (spoken.action === "resume" && !current.snapshot.state.canResume) {
          setNotice(t("voice.resumeUnavailable"));
          return;
        }
        void command("/sessions/" + snapshot.sessionId + "/" + spoken.action).catch(() =>
          setNotice(t("voice.failed")),
        );
        return;
      }
      submission.enqueue({ text: spoken.text, steering: spoken.steering, id: _id });
      setSteering(false);
    },
  });
  const submission = useVoiceSubmission({
    snapshot,
    connected,
    editing,
    voice,
    prompt,
    notice: setNotice,
  });
  const resetNarration = useVoiceNarration(snapshot, voice);
  const start = (mode: "dictation" | "conversation") => {
    if (!setup.complete) return;
    submission.clear();
    const draft = useWorkspace.getState().drafts[snapshot.sessionId] ?? "";
    base.current = draft + (draft && !/\s$/.test(draft) ? " " : "");
    resetNarration();
    setNotice("");
    void voice.start(mode);
  };
  useEffect(() => {
    owner.current = snapshot.sessionId;
    setSteering(false);
  }, [snapshot.sessionId]);
  useEffect(() => {
    const edit = () => {
      if (voice.mode === "dictation") {
        void voice.stop();
        setNotice(t("voice.editPause"));
      }
    };
    window.addEventListener("loop-voice-edit", edit);
    return () => window.removeEventListener("loop-voice-edit", edit);
  }, [voice.mode, voice.stop, t]);
  useEffect(() => {
    if (voice.mode !== "conversation") return;
    if (editing || !connected || snapshot.state.hasPendingSave) {
      voice.mute(true);
      voice.interrupt();
    }
  }, [editing, connected, snapshot.state.hasPendingSave, voice.mode]);
  const editTranscript = () => {
    voice.mute(true);
    voice.interrupt();
    submission.remove(utterance.current);
    appendVoiceDraft(snapshot.sessionId, voice.text);
    setNotice(t("voice.transcriptEditing"));
    document.querySelector<HTMLElement>(".composer-input[contenteditable]")?.focus();
  };
  const stopTask = () => {
    submission.clear();
    void command("/sessions/" + snapshot.sessionId + "/abort").catch(() =>
      setNotice(t("voice.failed")),
    );
  };
  return {
    voice,
    start,
    steering,
    setSteering,
    notice,
    editTranscript,
    stopTask,
    editing,
    prompt,
    setupComplete: setup.complete,
    blocked:
      !connected ||
      !hasProject ||
      prompt.pending ||
      prompt.uncertain ||
      snapshot.state.hasPendingSave,
  };
};
