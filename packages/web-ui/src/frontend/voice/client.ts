import type { VoiceConnection } from "../../shared/voice";
import { startCapture } from "./capture";
import type { VoiceCapture } from "./capture-types";
import type { VoiceClient, VoiceClientOptions } from "./client-types";
import { voiceCommand } from "./request";
import { connectVoice } from "./socket";
import type { VoiceSocket } from "./socket-types";
import { SpeechActivity } from "./speech-activity";
import { VoicePlayback } from "./voice-playback";
import { VoiceSpeechQueue } from "./voice-speech-queue";

export const startVoice = async (options: VoiceClientOptions): Promise<VoiceClient> => {
  const clientId = crypto.randomUUID();
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal]);
  let connection: VoiceConnection | undefined;
  let capture: VoiceCapture | undefined;
  let socket: VoiceSocket | undefined;
  let playback: VoicePlayback | undefined;
  let speech: VoiceSpeechQueue | undefined;
  let muted = false;
  let readingPaused = false;
  let connected = false;
  let closed = false;
  const activity = new SpeechActivity();
  const interrupt = () => {
    speech?.clear();
    const generation = playback?.interrupt() ?? 0;
    socket?.send({ type: "interrupt", generation });
  };
  const close = async () => {
    if (closed) return;
    closed = true;
    interrupt();
    socket?.send({ type: "close" });
    controller.abort();
    await capture?.close();
    if (connection)
      await voiceCommand("/voice/calls/" + connection.callId + "/close", { clientId }).catch(
        () => {},
      );
  };
  try {
    // Start capture before awaiting HTTP so AudioContext resume retains the click gesture.
    capture = await startCapture({
      signal,
      interrupted: () => {
        options.status("paused");
        void close();
      },
      frame: (bytes, energy) => {
        if (!connected || muted) return;
        const change = activity.push(energy);
        if (change === "start") {
          interrupt();
          options.status("listening");
        }
        if (!socket?.pcm(bytes)) {
          options.failed(new Error("audio_backpressure"));
          void close();
        }
        if (change === "end") socket?.send({ type: "finish" });
      },
    });
    playback = new VoicePlayback(capture.context, (playing) => {
      if (!closed) options.status(playing ? "speaking" : "listening");
    });
    speech = new VoiceSpeechQueue({
      send: (text) => socket?.send({ type: "speak", text, generation: playback?.current() ?? 0 }),
      play: (bytes, generation) => playback?.play(bytes, generation) ?? Promise.resolve(),
      current: () => playback?.current() ?? 0,
      interrupt,
    });
    await options.waitForClose;
    signal.throwIfAborted();
    connection = await voiceCommand<VoiceConnection>(
      "/voice/calls",
      {
        sessionId: options.sessionId,
        mode: options.mode,
        clientId,
      },
      { signal, timeout: 40_000 },
    );
    if (signal.aborted) {
      await voiceCommand("/voice/calls/" + connection.callId + "/close", { clientId }).catch(
        () => {},
      );
    }
    signal.throwIfAborted();
    socket = connectVoice({
      connection,
      clientId,
      signal,
      ready: () => {
        connected = true;
        socket?.send({ type: "interrupt", generation: playback?.current() ?? 0 });
        socket?.send({ type: "configure", muted, readingPaused });
        options.status("listening");
      },
      disconnected: () => {
        connected = false;
        activity.reset();
        capture?.discard();
        interrupt();
        options.status("reconnecting");
      },
      failed: (error) => {
        options.failed(error);
        void close();
      },
      event: (event) => {
        if (event.type === "error" && /synthesis|tts|speech/.test(event.code)) speech?.failed();
        if (event.type !== "transcript" || (connected && !muted)) options.event(event);
      },
      audio: (bytes, generation) => {
        if (!readingPaused) speech?.audio(bytes, generation);
      },
    });
    return {
      mute: (value) => {
        muted = value;
        capture?.mute(value);
        activity.reset();
        socket?.send({ type: "configure", muted, readingPaused });
      },
      pauseReading: (value) => {
        readingPaused = value;
        if (value) interrupt();
        socket?.send({ type: "configure", muted, readingPaused });
      },
      interrupt,
      finish: () => {
        if (options.mode === "dictation") capture?.mute(true);
        activity.reset();
        socket?.send({ type: "finish" });
      },
      speak: (text) => {
        if (connected && !readingPaused) speech?.enqueue(text);
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
};
