import { randomUUID } from "node:crypto";

import { decodeVoiceSamples } from "./audio-codec";
import { encodeVoiceCommand } from "./command-encoder";
import { MAX_VOICE_AUDIO_BYTES } from "./protocol-constants";
import type { VoiceFrame } from "./protocol-types";
import { VoiceSidecarProcess } from "./voice-sidecar-process";
import type {
  VoiceCallMode,
  VoiceEvent,
  VoiceEventListener,
  VoiceRuntimeOptions,
  VoiceSynthesisOptions,
  VoiceRuntimeResources,
} from "./voice-types";

export class VoiceCall {
  readonly id = randomUUID();
  private readonly process: VoiceSidecarProcess;
  private readonly listeners = new Set<VoiceEventListener>();
  private readonly speech = new Map<string, string>();
  private started = false;
  private closing?: Promise<void>;
  private audioPending = 0;
  private discarding?: Promise<void>;
  private synthesisTail: Promise<void> = Promise.resolve();
  private readonly cancellations = new Map<string, () => void>();

  constructor(
    readonly mode: VoiceCallMode,
    private readonly resources: VoiceRuntimeResources,
    options: VoiceRuntimeOptions,
    private readonly release: () => void,
  ) {
    this.process = new VoiceSidecarProcess(
      resources,
      this.receive,
      (code) => {
        this.emit({ callId: this.id, type: "error", code });
        void this.close();
      },
      options.startupTimeoutMs,
      options.operationTimeoutMs,
    );
  }

  start = async (): Promise<void> => {
    try {
      await this.process.start();
      if (this.closing) throw new Error("voice_call_closed");
      this.started = true;
      this.emit({ callId: this.id, type: "state", state: "listening" });
    } catch (error) {
      await this.close();
      throw error;
    }
  };

  subscribe = (listener: VoiceEventListener): (() => void) => {
    if (this.closing) throw new Error("voice_call_closed");
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Accept mono PCM16LE at 16 kHz. Acknowledgement provides bounded backpressure. */
  writeAudio = async (samples: Uint8Array): Promise<void> => {
    this.assertOpen();
    if (this.discarding) throw new Error("voice_input_resetting");
    if (
      !(samples instanceof Uint8Array) ||
      !samples.byteLength ||
      samples.byteLength % 2 ||
      samples.byteLength > MAX_VOICE_AUDIO_BYTES
    )
      throw new Error("voice_invalid_audio");
    if (this.audioPending >= 16) throw new Error("voice_audio_overloaded");
    this.audioPending++;
    try {
      await this.process.send({
        v: 1,
        id: randomUUID(),
        type: "audio",
        samples: Buffer.from(samples).toString("base64"),
      });
    } finally {
      this.audioPending--;
    }
  };

  /** Flush the current utterance and reset recognition without closing the call. */
  endInput = async (): Promise<void> => {
    this.assertOpen();
    if (this.discarding) throw new Error("voice_input_resetting");
    await this.process.send({ v: 1, id: randomUUID(), type: "end" });
  };

  /** Reset recognition without publishing a partial utterance when muting or reconnecting. */
  discardInput = (): Promise<void> => {
    this.assertOpen();
    if (this.discarding) return this.discarding;
    this.discarding = this.process.send({ v: 1, id: randomUUID(), type: "end" }).finally(() => {
      this.discarding = undefined;
    });
    return this.discarding;
  };

  synthesize = async (text: string, options: VoiceSynthesisOptions = {}): Promise<void> => {
    this.assertOpen();
    if (!this.resources.configuration.tts) throw new Error("voice_tts_unavailable");
    options.signal?.throwIfAborted();
    const requestId = options.requestId ?? randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) throw new Error("voice_invalid_request_id");
    if ([...this.speech.values()].includes(requestId)) throw new Error("voice_duplicate_request");
    if (this.speech.size >= 4) throw new Error("voice_speech_overloaded");
    // Internal IDs never repeat, even if a host reuses a cancelled playback generation.
    const id = randomUUID();
    const command = {
      v: 1 as const,
      id,
      type: "synthesize" as const,
      text,
      ...(options.speaker === undefined ? {} : { speaker: options.speaker }),
    };
    encodeVoiceCommand(command);
    this.speech.set(id, requestId);
    const cancellation = Promise.withResolvers<never>();
    let active = false;
    let cancelled = false;
    const abort = () => {
      if (cancelled) return;
      cancelled = true;
      this.speech.delete(id);
      cancellation.reject(new Error("voice_cancelled"));
      if (active) this.process.cancel(id);
    };
    this.cancellations.set(id, abort);
    options.signal?.addEventListener("abort", abort, { once: true });
    const dispatch = this.synthesisTail.then(async () => {
      if (cancelled) throw new Error("voice_cancelled");
      this.assertOpen();
      active = true;
      await this.process.send(command);
    });
    this.synthesisTail = dispatch.catch(() => {});
    try {
      await Promise.race([dispatch, cancellation.promise]);
    } finally {
      options.signal?.removeEventListener("abort", abort);
      this.speech.delete(id);
      this.cancellations.delete(id);
    }
  };

  cancelSpeech = (): void => {
    for (const abort of this.cancellations.values()) abort();
    this.speech.clear();
  };

  close = (): Promise<void> => {
    if (this.closing) return this.closing;
    this.started = false;
    this.cancelSpeech();
    this.closing = this.process.close().finally(() => {
      this.emit({ callId: this.id, type: "state", state: "closed" });
      this.listeners.clear();
      this.release();
    });
    return this.closing;
  };

  private assertOpen = (): void => {
    if (!this.started || this.closing) throw new Error("voice_call_closed");
  };

  private emit = (event: VoiceEvent): void => {
    for (const listener of this.listeners) {
      try {
        listener(structuredClone(event));
      } catch {
        // Playback/UI observers cannot alter engine execution or resource cleanup.
      }
    }
  };

  private receive = (frame: VoiceFrame): void => {
    if (this.closing) return;
    if (frame.type === "speech" || frame.type === "transcript") {
      if (this.discarding) return;
      const { v: _version, id: _id, ...event } = frame;
      this.emit({ ...event, callId: this.id });
    } else if (frame.type === "audio" && this.speech.has(frame.id)) {
      this.emit({
        callId: this.id,
        type: "audio",
        requestId: this.speech.get(frame.id)!,
        samples: decodeVoiceSamples(frame.samples),
        sampleRate: frame.sampleRate,
      });
    } else if (frame.type === "error")
      this.emit({ callId: this.id, type: "error", code: frame.code });
  };
}
