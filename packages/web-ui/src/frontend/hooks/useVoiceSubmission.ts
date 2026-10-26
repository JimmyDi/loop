import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { voiceSubmissionNotice } from "../voice/commands";
import { preserveRejectedVoice } from "../voice/draft";
import type {
  VoiceQueuedSubmission,
  VoiceSubmissionControl,
  VoiceSubmissionOptions,
} from "./voice-submission-types";

export const useVoiceSubmission = ({
  snapshot,
  connected,
  editing,
  voice,
  prompt,
  notice,
}: VoiceSubmissionOptions): VoiceSubmissionControl => {
  const { t } = useTranslation();
  const [queued, setQueued] = useState<VoiceQueuedSubmission[]>([]);
  const [sending, setSending] = useState(false);
  const epoch = useRef(0);
  const clear = () => {
    epoch.current++;
    setQueued([]);
  };
  useEffect(clear, [snapshot.sessionId]);
  useEffect(() => {
    if (!voice.mode || voice.status === "paused") clear();
  }, [voice.mode, voice.status === "paused"]);
  useEffect(() => {
    if (queued.length >= 16) voice.mute(true);
  }, [queued.length, voice.mute]);
  useEffect(() => {
    const item = queued[0];
    if (
      !item ||
      voice.muted ||
      voice.mode !== "conversation" ||
      !["listening", "transcribing", "speaking"].includes(voice.status) ||
      sending ||
      prompt.pending ||
      prompt.uncertain ||
      !connected ||
      editing ||
      !["idle", "prompt"].includes(snapshot.operation) ||
      snapshot.state.hasPendingSave
    )
      return;
    setSending(true);
    const dispatchEpoch = epoch.current;
    void prompt
      .submitText(item.text, item.steering)
      .then((result) => {
        preserveRejectedVoice(snapshot.sessionId, item.text, result);
        if (dispatchEpoch !== epoch.current) return;
        if (result !== "accepted") voice.mute(true);
        notice(
          t(voiceSubmissionNotice(result === "accepted", item.steering, snapshot.state.isRunning)),
        );
        setQueued((items) => items.filter((queued) => queued.id !== item.id));
      })
      .finally(() => setSending(false));
  }, [
    queued,
    sending,
    voice.mode,
    voice.status,
    voice.muted,
    prompt.pending,
    prompt.uncertain,
    connected,
    editing,
    snapshot.operation,
    snapshot.state.hasPendingSave,
  ]);
  return {
    clear,
    remove: (id: string) => setQueued((items) => items.filter((item) => item.id !== id)),
    enqueue: (item: VoiceQueuedSubmission) =>
      setQueued((items) => {
        if (items.length >= 16) {
          notice(t("voice.queueFull"));
          return items;
        }
        return [...items, item];
      }),
  };
};
