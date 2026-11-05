---
title: "Local speech recognition: 167 MiB of downloads and the engineering trade-offs"
summary: "How local voice connects to Loop: model downloads, resource management, submission behavior, and the privacy boundaries of local inference."
author: Di
category: engineering
publishedAt: 2026-11-05
draft: false
---

Loop's speech recognition runs on the computer hosting its backend. The implementation does not call a cloud speech API.

Voice is optional: it requires installed resources and an explicit action to start listening.

The cost: **about 167.3 MiB of ASR/VAD model downloads, or 189.3 MiB expanded**, plus a platform engine and temporary installation space.

Recognition and synthesis run on the host. This does not mean a sentence never reaches a cloud service: the transcript goes to the configured Agent, and a phone sends audio to the Loop host.

This article explains that boundary, the resource pipeline, and why voice input and voice calls submit differently.

![Loop voice input: recording in progress with two queued follow-up messages](./voice-input-en-light.webp)

*Above: click Voice input to record. After stopping and completing transcription, text is appended to an editable draft for manual submission. The two items above it are queued follow-ups.*

## 1. Requirements for a voice integration

The criteria are where audio is processed, who controls capture and submission, and whether voice uses the existing session's permissions, queue, and history.

**Cloud speech APIs.** They remove the need to maintain a local model runtime, but introduce audio uploads, network requirements, and provider billing. This article includes no accuracy or total-cost benchmark and does not rank these options.

**OS-level dictation.** It can fill an input field and may be enough for that use case. Loop also needs control over capture, submission, and narration.

**Browser Web Speech API.** It can reduce integration work, but remote-service use depends on the browser implementation and configuration. The API name alone does not establish an offline guarantee.

**Open-source local ASR models.** Inference can run offline after resources are installed. The application still needs to integrate the model, runtime, and audio handling.

**Desktop voice tools.** They can pass text through an input field. That alone does not implement continuous calls, paused narration, steering, or task submission.

Voice needs to be **part of the Loop session**, using its existing permissions, queue, and history.

A local model gives the application control over inference location, along with responsibility for resource distribution and platform support.

## 2. What local inference actually changes

Raw-audio processing and subsequent model requests have separate boundaries.

### 2.1 One fewer recipient for raw audio

Short instructions might look like this:

```text
run the tests
change line two in this file
extract that function
```

**Short, frequent, back to back.**

This kind of input is easy to underestimate, because it does not sound "sensitive."

But workplace utterances carry project information: file names, module names, what is being changed, where progress is blocked.

Local ASR avoids sending raw audio to an additional cloud speech service just to obtain text. Local TTS also avoids sending reply text to a cloud synthesis service.

### 2.2 Transcripts and phone transport still cross boundaries

Transcripts use the ordinary session submission flow. **If the configured coding model is cloud hosted, that service may receive the text, just as it would receive typed input.** Local speech does not change that.

Here, "local" means **the computer running Loop's backend**. On a phone, microphone audio travels to that computer through its paired connection. With the current tunnel service, audio passes through a relay that terminates transport TLS. Local inference does not mean audio stays on the phone or that the relay cannot access it.

The implementation does not call cloud ASR or TTS. It is not a guarantee that every piece of data stays on the input device.

## 3. The pipeline behind it

These resources need to work together. A downloaded model alone is not a usable voice feature.

### 3.1 More than a model file

| Stage | What it does |
|---|---|
| **VAD** | Detects whether speech is present and when it stops |
| **ASR** | Turns audio into text |
| **TTS** | Reads the reply back |
| **Platform engine** | The native runtime per platform |
| **Resource management** | Versioning, verification, install, repair, uninstall |

**Each one costs disk space and code.**

### 3.2 How resources reach the host

![Resource pipeline: build, store, use](./pipeline-flow-en.png)

*Above: build per platform, store versioned resources, then download, verify, and activate after the user requests installation. Installation also depends on compatible resources being available.*

### 3.3 Download size is not installed size

| Component | Compressed download | Expanded size |
|---|---|---|
| ASR + VAD models | About **167.3 MiB** | About **189.3 MiB** |
| Optional bilingual TTS models | About **123.8 MiB more** | About **168.0 MiB more** |
| Platform engine | Additional | Additional |

These measurements describe the currently prepared pinned model assets, not permanent values for every version or platform. **The 167 MiB in the title is the ASR/VAD archive download, not the complete installed footprint.** Installation needs space for archives and staged files. Updates retain the previous activation until a replacement succeeds.

### 3.4 Six resource-management constraints

Resource management follows six constraints:

**1. Explicit installation**

Model downloads consume bandwidth and disk space, so they are not part of the startup path.

Downloads start only after the user requests installation in Settings. Missing compatible resources are reported as unavailable.

**2. Resources must be versioned**

Every public voice resource release uses an independent semantic version. Released content cannot be replaced under the same version, so the active resource set remains traceable.

**3. Downloads must be verified**

Model files have pinned sizes and SHA-256 checks. The engine also has to pass a native version probe. Resources that fail verification are not activated. Integrity checks alone are not proof of supply-chain security.

**4. It has to be repairable**

Repair operates at component granularity: recheck files and use verified replacement components when compatible downloads are available. It does not download only the few bytes that were damaged. A locally imported engine may need to be imported again.

**5. Removal covers managed resources**

Uninstall clears managed voice resources, partial downloads, and damaged installations while leaving unrelated Loop data intact.

**6. Unsupported resources are reported as unavailable**

When the platform or compatible resources are unavailable, voice reports that state without automatically falling back to cloud speech. This keeps the audio-processing boundary consistent.

## 4. Why voice input and voice calls submit differently

Both modes connect to the same session, but have different submission boundaries.

**Voice input is a way to edit the composer.** Click to record, then stop. The client waits for the backend to finish queued audio and the last phrase before appending text to the draft. The user can edit it and press Send. Discarding capture preserves the existing draft and attachments. A finalization failure reports an error rather than inserting incomplete text.

**Voice call keeps listening.** Final utterances submit automatically, and ordinary requests enter the existing task queue. The user can select the next utterance to correct direction; it reaches the Agent at the current tool batch boundary. The typed draft and attachments stay separate from the call.

Spoken replies use local TTS. Speaking over narration or pausing it clears the pending narration backlog. **Interrupting playback or hanging up does not cancel an Agent task that was already submitted.** Task cancellation remains a separate operation.

Transcription completion, submission, and playback interruption require separate state management. Turning audio into text solves only part of the interaction.

Audio flows through bounded processing buffers. Loop does not save it as a recording. **Submitted final text is stored through normal conversation history and may be sent to the configured model.** "No saved recording" does not mean "no information remains."

## 5. Current limitations

Local speech has several constraints that affect suitability.

| Scenario | Recommendation |
|---|---|
| Voice input is only needed for a quick trial | Compatible resources still need installing |
| The platform is unsupported | The capability is simply unavailable; there is no fallback |
| Particular accents, noise, or terminology matter | Test with those inputs; no accuracy ranking is provided |
| Phone use | Requires a secure context, microphone permission, a foreground page, and a host connection |

## 6. Is the trade worth it?

Speech recognition on the Loop host requires roughly 167.3 MiB of model downloads and a resource-management pipeline. Installing TTS adds locally synthesized replies.

This design removes an additional cloud speech service from the raw-audio path. It cannot guarantee that no cloud service ever sees the sentence. Keeping transcripts away from a cloud coding model requires separate consideration of model configuration.

Code: [the voice implementation](https://github.com/JimmyDi/loop/tree/main/packages/coding-agent/src/core/voice)

The [local voice runtime guide](https://github.com/JimmyDi/loop/blob/main/packages/coding-agent/src/docs/voice.md) covers contracts and resource limits. The [Web voice guide](https://github.com/JimmyDi/loop/blob/main/packages/web-ui/src/frontend/docs/voice.md) covers interactions and remote-audio boundaries.
