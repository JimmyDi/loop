import type { VoiceCapture, VoiceCaptureOptions } from "./capture-types";
import captureWorkletUrl from "./capture-worklet.ts?worker&url";
import { VoiceAudioOutput } from "./voice-audio-output";
import { voiceDevice } from "./device";
import { PcmResampler } from "./pcm-resampler";
import { pcmBytes, pcmEnergy } from "./pcm-utils";

export const startCapture = async (options: VoiceCaptureOptions): Promise<VoiceCapture> => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioContext)
    throw new Error("microphone_unavailable");
  const context = new AudioContext({ latencyHint: "interactive" });
  let output: VoiceAudioOutput | undefined;
  let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let sink: GainNode | undefined;
  let closed = false;
  let muted = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    options.signal.removeEventListener("abort", abort);
    stream?.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    node?.disconnect();
    sink?.disconnect();
    output?.close();
    if (context.state !== "closed") await context.close();
  };
  const abort = () => void close();
  options.signal.addEventListener("abort", abort, { once: true });
  try {
    // Start the media element in the initiating user gesture, before microphone permission.
    output = new VoiceAudioOutput(context);
    await Promise.all([context.resume(), output.start()]);
    const microphone = navigator.mediaDevices.getUserMedia({
      audio: {
        ...(voiceDevice() ? { deviceId: { ideal: voiceDevice() } } : {}),
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    void microphone
      .then((value) => {
        if (closed || options.signal.aborted) value.getTracks().forEach((track) => track.stop());
      })
      .catch(() => {});
    stream = await Promise.race([
      microphone,
      new Promise<never>((_resolve, reject) => {
        if (options.signal.aborted) reject(options.signal.reason);
        else
          options.signal.addEventListener("abort", () => reject(options.signal.reason), {
            once: true,
          });
      }),
    ]);
    options.signal.throwIfAborted();
    window.dispatchEvent(new window.Event("loop-voice-permission"));
    await context.audioWorklet.addModule(captureWorkletUrl);
    options.signal.throwIfAborted();
    let resampler = new PcmResampler(context.sampleRate);
    let pending: number[] = [];
    let finishing: Promise<void> | undefined;
    let finished: (() => void) | undefined;
    node = new AudioWorkletNode(context, "loop-capture");
    node.port.onmessage = (event: MessageEvent<Float32Array | "finished">) => {
      if (event.data === "finished") {
        finished?.();
        return;
      }
      if (closed || muted || options.signal.aborted) return;
      const samples = resampler.push(event.data);
      pending.push(...samples);
      while (pending.length >= 320) {
        const frame = Int16Array.from(pending.splice(0, 320));
        options.frame(pcmBytes(frame), pcmEnergy(frame));
      }
    };
    source = context.createMediaStreamSource(stream);
    sink = context.createGain();
    sink.gain.value = 0;
    source.connect(node).connect(sink).connect(context.destination);
    stream.getAudioTracks().forEach((track) => {
      track.onended = options.interrupted;
    });
    context.onstatechange = () => {
      if (!closed && context.state !== "running") options.interrupted();
    };
    return {
      context,
      playbackDestination: output.destination,
      mute: (value) => {
        muted = value;
        pending = [];
        resampler = new PcmResampler(context.sampleRate);
        if (!value && finishing) {
          finishing = undefined;
          finished = undefined;
          node!.port.postMessage("resume");
        }
      },
      discard: () => {
        pending = [];
        resampler = new PcmResampler(context.sampleRate);
      },
      finish: () => {
        if (finishing) return finishing;
        finishing = (async () => {
          options.signal.throwIfAborted();
          await new Promise<void>((resolve, reject) => {
            const abort = () => reject(options.signal.reason);
            options.signal.addEventListener("abort", abort, { once: true });
            finished = () => {
              options.signal.removeEventListener("abort", abort);
              resolve();
            };
            node!.port.postMessage("finish");
          });
          options.signal.throwIfAborted();
          if (pending.length) {
            const frame = Int16Array.from(pending);
            pending = [];
            options.frame(pcmBytes(frame), pcmEnergy(frame));
          }
          muted = true;
        })();
        return finishing;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
};
