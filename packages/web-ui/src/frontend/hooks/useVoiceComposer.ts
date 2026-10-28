import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../shared/protocol";
import { useVoiceDictation } from "./useVoiceDictation";
import { useVoice } from "./useVoice";
import { usePrompt } from "./usePrompt";
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
  const [steering, setSteering] = useState(true);
  const [notice, setNotice] = useState("");
  const dictation = useVoiceDictation(snapshot.sessionId);
  const [callSamples, setCallSamples] = useState<number[]>([]);
  const sampleTime = useRef(0);
  const latest = useRef({ snapshot, connected, editing, hasProject, steering });
  const owner = useRef(snapshot.sessionId);
  const utterance = useRef("");
  latest.current = { snapshot, connected, editing, hasProject, steering };
  const voice = useVoice({
    sessionId: snapshot.sessionId,
    energy: (value) => {
      dictation.energy(value);
      if (performance.now() - sampleTime.current < 70) return;
      sampleTime.current = performance.now();
      setCallSamples((previous) => [...previous.slice(-79), value]);
    },
    transcript: (text, final, _id, mode) => {
      if (owner.current !== snapshot.sessionId) return;
      if (mode === "dictation") {
        dictation.transcript(text, final, _id);
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
    if (!setup.ready) return;
    submission.clear();
    if (mode === "dictation") dictation.begin();
    if (mode === "conversation") setSteering(true);
    setCallSamples([]);
    resetNarration();
    setNotice("");
    void voice.start(mode);
  };
  useEffect(() => {
    owner.current = snapshot.sessionId;
    setSteering(true);
  }, [snapshot.sessionId]);
  useEffect(() => {
    const edit = () => {
      if (voice.mode === "dictation") {
        dictation.discard(voice);
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
    dictation,
    callSamples,
    start,
    steering,
    setSteering,
    notice,
    editTranscript,
    stopTask,
    editing,
    prompt,
    setupComplete: setup.ready,
    blocked:
      !connected ||
      !hasProject ||
      prompt.pending ||
      prompt.uncertain ||
      snapshot.state.hasPendingSave,
  };
};
