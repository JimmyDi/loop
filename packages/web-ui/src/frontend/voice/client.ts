import type { VoiceConnection } from "../../shared/voice";
import { startCapture } from "./capture";
import type { VoiceCapture } from "./capture-types";
import type { VoiceClient, VoiceClientOptions } from "./client-types";
import { voiceCommand } from "./request";
import { connectVoice } from "./socket";
import { startConnection } from "./start-connection";
import type { VoiceSocket } from "./socket-types";
import { SpeechActivity } from "./speech-activity";
import { VoicePlayback } from "./voice-playback";
import { VoiceSpeechQueue } from "./voice-speech-queue";
import { ConnectionMusic } from "./connection-music";

export const startVoice = async (options: VoiceClientOptions): Promise<VoiceClient> => {
  const clientId = crypto.randomUUID();
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal]);
  let connection: VoiceConnection | undefined;
  let capture: VoiceCapture | undefined;
  let socket: VoiceSocket | undefined;
  let playback: VoicePlayback | undefined;
  let speech: VoiceSpeechQueue | undefined;
  let music: ConnectionMusic | undefined;
  let muted = false;
  let readingPaused = false;
  let connected = false;
  let initialConnection = true;
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
    music?.stop();
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
    const connecting = startConnection(options, clientId, signal).then((value) => {
      connection = value;
      return value;
    });
    void connecting.catch(() => {});
    // Start capture before awaiting HTTP so AudioContext resume retains the click gesture.
    capture = await startCapture({
      signal,
      interrupted: () => {
        options.status("paused");
        void close();
      },
      frame: (bytes, energy) => {
        if (!connected || muted) return;
        options.energy?.(energy);
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
    if (options.mode === "conversation") {
      music = new ConnectionMusic(capture.context);
      signal.addEventListener("abort", () => music?.stop(), { once: true });
      music.start();
    }
    playback = new VoicePlayback(
      capture.context,
      (playing) => {
        if (!closed) options.status(playing ? "speaking" : "listening");
      },
      options.playbackProgress,
      capture.playbackDestination,
    );
    speech = new VoiceSpeechQueue({
      send: (text) => socket?.send({ type: "speak", text, generation: playback?.current() ?? 0 }),
      play: (bytes, generation) => playback?.play(bytes, generation) ?? Promise.resolve(),
      current: () => playback?.current() ?? 0,
      interrupt,
    });
    connection = await connecting;
    signal.throwIfAborted();
    socket = connectVoice({
      connection,
      clientId,
      signal,
      ready: () => {
        music?.stop();
        initialConnection = false;
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
        if (initialConnection) music?.start();
      },
      failed: (error) => {
        options.failed(error);
        void close();
      },
      event: (event) => {
        if (event.type === "error") music?.stop();
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
      finish: async (requestId) => {
        if (options.mode !== "conversation") await capture?.finish();
        activity.reset();
        socket?.send({ type: "finish", requestId });
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
