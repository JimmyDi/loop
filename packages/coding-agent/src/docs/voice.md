# Local Voice Runtime

Coding-agent core runs a separately installed native speech engine. Recognition and synthesis stay on the host running Loop; a phone client sends microphone audio to that host. The runtime does not call the coding model, submit tasks, store recordings or create a second Agent. A host sends final recognized text through its existing session submission flow. The configured coding model can receive that text.

## Usage

After acquiring installed resources from the resource manager:

```typescript
import { VoiceRuntime } from "@loop/coding-agent";
import type { VoiceRuntimeResources } from "@loop/coding-agent";

const useVoice = async (resources: VoiceRuntimeResources, pcm: Uint8Array) => {
  const runtime = new VoiceRuntime({ resources: () => resources });
  const call = await runtime.startCall({ mode: "dictation" });
  const unsubscribe = call.subscribe((event) => {
    if (event.type === "transcript") console.log(event.text, event.final);
  });
  try {
    await call.writeAudio(pcm);
    await call.endInput();
  } finally {
    unsubscribe();
    await runtime.close();
  }
};
```

`VoiceRuntimeOptions.resources` returns either `VoiceRuntimeResources` or a lease containing `{ resources, release }`. The runtime releases a lease exactly once after startup failure or call closure. Resource managers can use that lease to prevent update/uninstall during inference. `executablePath` and optional `args` identify the installed executable; `configuration` supplies ASR encoder/decoder/joiner/tokens, the VAD model and optional TTS model/voices/tokens/lexicon/data directory. These are trusted host configuration, never model arguments.

## Installed resources

`VoiceResourceManager(agentDir)` owns the `voice/` directory under the supplied Loop data root, which defaults to `~/.loop/voice` and follows `LOOP_DATA_DIR` or an SDK `agentDir`. `status()` reports installed components and availability; `install({ tts? }, signal?)`, `update({ tts? }, signal?)` and `uninstall()` manage them. `acquireRuntime()` returns a lease accepted directly by `VoiceRuntimeOptions.resources`. A resource-directory lock excludes active inference and mutations across managers and processes. ASR, VAD and optional TTS files have pinned sizes and SHA-256 checks; activation occurs after validation and a successful native version probe. `installed` requires a complete activation, while `ttsInstalled` requires TTS in that usable activation; component status separately reports cached files.

The current published Loop engine/model asset catalogs are empty. A fresh installation therefore reports unavailable assets instead of manufacturing a download URL; the settings actions cannot download an unpublished bundle. Local development can build the native engine and import its manifest with `importLocalEngine(directory, manifest)`, then import the pinned ASR/VAD and optional TTS model directories with `importLocalModels(directory)` before activation. These SDK imports are trusted local operations. Publishing reviewed platform bundles and populating the catalogs remains necessary for first-install downloads and version updates. `updateAvailable` compares the active catalog and content digests with the current compatible definitions. Failed or cancelled updates retain the previous activation, and default updates preserve and verify an already activated TTS component.

Interrupted downloads resume only after exact byte-range validation and finish with a complete digest check. A verified replacement repairs corrupt component directories through staging before activation. Malformed activation metadata reports an uninstalled state so removal remains available. Uninstall removes managed resources and leaves unrelated Loop data intact.

The prepared pinned ASR/VAD model archives total about 167.3 MiB to download and 189.3 MiB expanded. Optional bilingual TTS adds about 123.8 MiB to download and 168.0 MiB expanded. The platform engine is additional; its final size depends on the reviewed build. Installation also needs temporary space for compressed archives and staged files, and an update retains the prior activation until replacement succeeds. These sizes describe the current locally prepared model assets rather than a published download.

The currently validated macOS ARM64 source build adds about 8.6 MiB of download and 27.2 MiB expanded. The complete input-and-speech profile is about 299.7 MiB to download and 384.5 MiB expanded before temporary installation space. Rebuilding or updating dependencies can change those measurements.

From the repository root, this local developer workflow downloads pinned upstream dependencies/models, builds for the current platform and activates the verified files. It does not upload or publish assets:

```bash
node --import tsx packages/coding-agent/src/core/voice/native/build-clean.ts .tools/voice/native
node --import tsx packages/coding-agent/src/core/voice/native/prepare-models.ts .tools/voice/model-assets
node --import tsx packages/coding-agent/src/core/voice/native/import-local.ts .tools/voice/native .tools/voice/model-assets/models
```

The source build currently supports macOS ARM64 and needs a C++17 compiler, CMake, a build tool, Python 3.10 or newer and archive tools. These are development requirements; end users download the prepared native package. `prepare-models.ts` prepares ASR/VAD and TTS, including component archives and metadata for review; those archives are not automatically registered as downloadable releases. Imported voice resources live under Loop's configured data root rather than the workspace. See the [native resource guide](../core/voice/native/README.md) for release preparation, lock recovery and retained license notices. Catalog preparation defaults to macOS ARM64 for the first release and accepts an explicit platform set for later releases. Real runtime validation currently covers macOS ARM64; the other four platform bundles and their linked dependency notices still require their CI runs and release review.

## API and events

| API | Contract |
| --- | --- |
| `runtime.startCall({ mode })` | Open one `dictation` or `conversation` call; reject another while opening or active. Both modes expose the same audio primitives; the host owns submission behavior. |
| `call.writeAudio(samples)` | Supply mono PCM16LE at 16 kHz, nonempty even-length chunks up to 32 KiB. Await each acknowledgement for backpressure. |
| `call.endInput()` | Force the final transcript and reset recognition while keeping the call open. |
| `call.discardInput()` | Reset recognition while suppressing pending partial/final text and voice activity. Await before accepting microphone audio again; use when muting or restoring a connection. |
| `call.synthesize(text, { requestId?, speaker?, signal? })` | Stream synthesized PCM through `audio` events and resolve after completion. TTS must be installed. Text is limited to 16 KiB UTF-8. |
| `call.cancelSpeech()` | Cancel current synthesis requests and ignore their later audio. Recognition stays active. |
| `call.subscribe(listener)` | Receive isolated `speech`, `transcript`, `audio`, `state` and `error` events with `callId`; return an unsubscribe function. |
| `call.close()` / `runtime.close()` | Stop the engine and release resources; repeated close is safe. Does not stop an Agent task. |

`transcript` carries `text` and `final`. `speech` carries `active` for voice activity. `audio` contains raw PCM16LE `samples: Uint8Array`, `sampleRate` and the host's `requestId`; the host owns playback, framing and interruption. Internal synthesis identifiers never repeat, so reusing a cancelled host playback ID cannot accept stale engine audio. `state` reports `listening` or `closed`; `error` carries a bounded safe error code without engine diagnostics or local paths. Observer exceptions do not stop inference.

## Lifecycle and limits

The runtime uses version 1 JSONL over a child process's standard streams. Input/output frames are bounded to 1 MiB; PCM chunks are bounded to 32 KiB. At most 16 audio requests and four synthesis requests may be pending, with 64 total protocol requests. Synthesis runs sequentially in arrival order; interruption cancels both the active request and waiting narration. Startup defaults to 30 seconds and operations to 60 seconds. Hosts should await audio acknowledgements and queue short spoken summaries rather than sending unbounded audio or narration.

Malformed output, timeout or unexpected process exit rejects pending requests, terminates the engine and closes the call. Native diagnostics are drained without persisting or exposing their contents. Dictation works without TTS; synthesis then rejects `voice_tts_unavailable`. Cancelling speech never cancels the Agent task. Hangup does not undo or stop work already accepted by a session. Calls, audio and transcripts-in-progress are transient; only final text submitted to the session enters history.

The runtime does not acquire a microphone, play audio, grant browser permissions, implement background wake words, reconnect a client or infer approval decisions. Web owns these interactions and its existing delivery confirmation. Network restoration does not require persisting audio, queue state or native process frames.

## Source and tests

- [Runtime](../core/voice/voice-runtime.ts), [call](../core/voice/voice-call.ts), [runtime tests](../core/voice/voice-runtime.test.ts) and [call tests](../core/voice/voice-call.test.ts).
- [Protocol types](../core/voice/protocol-types.ts), [frame decoding](../core/voice/voice-frame-decoder.ts), [frame validation](../core/voice/frame-parser.ts) and [command encoding](../core/voice/command-encoder.ts).
- [Public types](../core/voice/voice-types.ts), [message queue](message-queue.md) and [approvals](approvals.md).
- [Resource manager](../core/voice/voice-resource-manager.ts), [pinned catalog](../core/voice/resources/catalog.ts), [native build](../core/voice/native/build.ts) and [local model preparation](../core/voice/native/prepare-models.ts).
