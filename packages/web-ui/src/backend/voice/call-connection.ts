import type { WebSocket } from "ws";

import { sendVoiceEvent } from "./call-events";
import { acceptVoiceAudio, controlVoiceCall } from "./call-input";
import type { VoiceConnectionOptions, WebVoiceCall } from "./call-types";

export const connectVoiceCall = (socket: WebSocket, options: VoiceConnectionOptions): void => {
  let state: WebVoiceCall | undefined;
  let alive = true;
  const timeout = setTimeout(() => socket.close(1008, "voice_authentication_timeout"), 5_000);
  const heartbeat = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    socket.ping();
  }, 15_000);
  heartbeat.unref();
  timeout.unref();
  socket.on("pong", () => {
    alive = true;
  });
  socket.on("message", (data, binary) => {
    try {
      if (!state) {
        if (binary || data.toString().length > 1_024) throw new Error("voice_unauthorized");
        const event = JSON.parse(data.toString());
        if (event?.type !== "authenticate") throw new Error("voice_unauthorized");
        state = options.authenticate(event.ticket);
        if (state.socket) throw new Error("voice_call_connected");
        state.socket = socket;
        state.utteranceId = crypto.randomUUID();
        clearTimeout(state.lease);
        clearTimeout(timeout);
        const attached = state;
        void state.input.then(() => {
          if (attached.socket === socket)
            sendVoiceEvent(attached, { type: "ready", callId: attached.id });
        });
        return;
      }
      if (binary) acceptVoiceAudio(state, data);
      else {
        if (data.toString().length > 4_096) throw new Error("voice_invalid_control");
        controlVoiceCall(state, JSON.parse(data.toString()), () => void options.end(state!));
      }
    } catch {
      socket.close(1008, "voice_invalid_message");
    }
  });
  socket.once("close", () => {
    clearTimeout(timeout);
    clearInterval(heartbeat);
    if (!state || !options.isCurrent(state) || state.socket !== socket) return;
    const detached = state;
    detached.socket = undefined;
    detached.call.cancelSpeech();
    detached.speech.clear();
    detached.discarding = true;
    detached.input = detached.input
      .then(() => detached.call.discardInput())
      .catch(() => {})
      .finally(() => {
        detached.discarding = false;
      });
    options.disconnected(detached);
  });
};
