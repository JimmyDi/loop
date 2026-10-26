# Voice Input and Calls

Loop uses local recognition and speech on the computer running its backend. Voice controls add text to the existing conversation and retain its permission checks, tool results, queue and history. The browser never uses cloud speech recognition or synthesis.

## Usage

Open **Settings → Voice** and follow the three setup steps:

1. **Choose voice features**: select editable voice input or input with local spoken replies.
2. **Install voice components**: use the download icon beside the title. The same row provides repair, update, uninstall, inline download progress and cancellation. Expand **Component sizes, licenses and storage** to inspect versions, sizes, licenses and the host storage directory. Loading starts when the command is sent; completion comes from backend resource checks. Errors stay in this step with manual retry, and status refresh recovers background work after a lost command response.
3. **Test voice**: select a microphone and test recognition after the selected resources are ready. A nonempty final transcript marks this step complete; partial speech and voice previews do not. Stopping a successful test retains its completion, while changing microphone or resource readiness resets it. This check is local to the open Settings panel.

Management is available only on the host computer; paired phones can select and test components already installed there. Missing published engine assets or unsupported platforms remain unavailable rather than silently falling back to a different speech service. Downloads support cancellation, without a separate pause control.

Component sizes distinguish the download archive, the installed file size required even before installation, and bytes currently installed. Temporary download and extraction space is additional.

Use **Verify and repair** for an installed profile to recheck file hashes and replace damaged downloadable components. A locally imported engine may require another local import when its files are damaged. Updates become available when the installed activation differs from the available catalog.

**Uninstall** also clears managed partial downloads and damaged installations. Resources are stored under the backend's Loop data directory (`~/.loop/voice` by default), never inside the PWA. The current prepared ASR/VAD models require about 167.3 MiB of download; adding bilingual spoken replies adds about 123.8 MiB. The platform engine and temporary installation space are additional, and Settings reports reviewed sizes when published assets are available.

The locally validated macOS ARM64 engine brings the complete profile to about 299.7 MiB of download and 384.5 MiB expanded. These are measurements of prepared local artifacts; published versions may differ.

Choose **Test microphone** to inspect recognition without sending an Agent prompt. **Preview voice** plays a short local sample when speech resources are installed. Both require an explicit browser microphone permission and a secure origin.

Select a microphone to use it for the next call. Device names refresh after microphone permission is granted; opening settings alone never requests recording access. The selection is stored in this browser, and an unavailable device falls back to the system default.

The session offers two voice controls:

- **Voice input**, the microphone icon at the far right of the input’s first row, appears when the displayed input has no visible text. Spaces and line breaks still count as empty. Entering visible text or recognized speech removes both the button and its layout slot; clearing the text restores it. Draft whitespace is preserved. Recognized speech fills the editable draft. Partial text is replaced as recognition improves. Stop speaking or choose Finish voice input, edit the text, then use the usual Send button. Manual typing pauses voice input. Attachments and selected Skills remain in the draft.
- **Call**, at the far right of the session bar, keeps listening and submits final utterances automatically. The typed draft, attachments and selected Skills stay separate. Ordinary requests use the existing task queue. Choose **Use next utterance to correct direction** to submit the next final utterance as steering at the current tool batch boundary.

Call status and controls appear below the composer during a voice session; the idle composer has no extra call row. The header action and editable voice input share one voice connection. Switching sessions closes that connection. During a call, microphone mute, spoken-reply pause, task cancellation and hangup are separate controls. Speaking stops playback immediately and keeps listening. The explicit phrases `stop task`, `cancel task`, `停止任务`, `停止执行` and `取消任务` cancel the current Agent task. They do not undo completed changes. The screen remains available for messages, code, tool output and approval cards; speech does not approve tool requests.

Say `resume task`, `继续任务`, `恢复任务` or `继续执行` to resume an available stopped task. Say `调整要求：…`, `纠正方向：…` or `correct direction: …` to submit the nonempty remainder as steering. Only final transcripts are interpreted as commands.

**Edit text** pauses the microphone and copies the displayed utterance into the input for manual editing and sending. It cannot withdraw an utterance that the Agent has already accepted. Editing an existing queued message pauses automatic sending. Unmute after editing to continue the call. New utterances never replace a queue item being edited. Existing request IDs and stream IDs protect voice submissions against uncertain delivery; the ordinary Check and retry action applies if acceptance is unknown.

## Lifecycle and Recovery

Microphone capture and playback start from an explicit click or tap. The browser requests mono audio with echo cancellation and noise suppression, resamples its actual capture rate to 16 kHz PCM, and shows call status independently from Agent task status. Browser audio processing and physical echo performance vary by device.

The browser also finalizes active speech after 1.2 seconds of silence. Finishing voice input requests a final transcript and waits up to 1.8 seconds before closing, retaining the latest text if recognition does not finish in time. Spoken replies use at most two short completed sentences and refer longer details to the screen. Narration has one synthesis/playback in progress and at most three waiting milestones; speaking or pausing reading clears that backlog.

Transient socket interruptions reconnect to the same live call with a fresh one-time ticket, retrying transient failures up to five times within 30 seconds. Previous audio and partial utterances are discarded. Completed speech is not replayed, and commands are not automatically resent. If the backend or call lease expires, choose Continue voice to start again; server restarts do not restore queued tasks.

Backgrounding, locking the phone, losing the network or a system microphone interruption pauses the foreground call. Navigating away also closes microphone capture and clears the live transcript; restoring the page from browser history keeps the call paused until Continue voice is chosen. Mute and spoken-reply pause requested during connection also apply when startup finishes. Switching chats ends the previous foreground call; accepted Agent tasks continue in their original session. Hanging up does not stop a task.

## Privacy and Limits

Audio remains in bounded processing buffers and is not saved as a recording. Final text is stored through the usual conversation history and sent to the configured Agent, which may be cloud hosted. A phone sends audio to the computer through its paired connection; the current tunnel service terminates transport TLS, so local inference does not mean audio stays on the phone.

Wake words, continuous background listening and operating-system voice integration are not provided. Mobile microphone permissions, audio-route changes, speaker echo and foreground recovery require real iOS/Android browser and installed-PWA checks. Model and engine availability is reported by the backend; the UI does not imply that release assets have been published.

## Source and Tests

- [Call entry](../components/chat/VoiceCallButton.tsx), [voice controls](../components/chat/VoiceControls.tsx), [call display](../components/chat/VoiceCallPanel.tsx), [call actions](../components/chat/VoiceCallActions.tsx) and their colocated tests.
- [Composer integration](../hooks/useVoiceComposer.ts), [submission queue](../hooks/useVoiceSubmission.ts) and their colocated tests.
- [Settings](../components/settings/VoiceSettings.tsx), [profile step](../components/settings/VoiceProfileStep.tsx), [resource step](../components/settings/VoiceResourceStep.tsx), [test step](../components/settings/VoiceTestStep.tsx), [step layout](../components/settings/VoiceSetupStep.tsx), [resource actions](../components/settings/VoiceResourceActions.tsx), [download progress](../components/settings/VoiceDownloadProgress.tsx) and their colocated tests.
- [PCM resampling](../voice/pcm-resampler.ts), [PCM utilities](../voice/pcm-utils.ts), [playback](../voice/voice-playback.ts), [narration](../voice/narration-utils.ts), [narration tracking](../voice/voice-narration-tracker.ts) and [socket transport](../voice/socket.ts), each with colocated tests.
- [Backend contract](../../backend/docs/voice.md), [chat input](chat.md), [approvals](permissions.md) and [mobile/PWA](pwa.md).
