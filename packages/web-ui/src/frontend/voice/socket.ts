import type { VoiceConnection, VoiceServerEvent } from "../../shared/voice";
import { ApiError } from "../lib/api";
import { voiceCommand } from "./request";
import type { VoiceSocket, VoiceSocketOptions } from "./socket-types";

export const connectVoice = (options: VoiceSocketOptions): VoiceSocket => {
  let socket: WebSocket | undefined;
  let pendingAudio: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let failures = 0;
  let disconnectedAt = 0;
  const retry = (connection: VoiceConnection, immediate = false) => {
    if (closed || options.signal.aborted) return;
    disconnectedAt ||= Date.now();
    if (++failures > 5 || Date.now() - disconnectedAt > 30_000) {
      options.failed(new Error("connection_lost"));
      return;
    }
    timer = setTimeout(
      () => {
        void voiceCommand<VoiceConnection>(
          "/voice/calls/" + connection.callId + "/connect",
          {
            clientId: options.clientId,
          },
          { signal: options.signal },
        )
          .then(open)
          .catch((error) => {
            if (closed || options.signal.aborted) return;
            if (error instanceof ApiError && error.status < 500) options.failed(error);
            else retry(connection);
          });
      },
      immediate ? 500 : Math.min(5000, 500 * 2 ** failures),
    );
  };
  const open = (connection: VoiceConnection) => {
    if (closed || options.signal.aborted) return;
    const url = new URL("/api/voice/calls/" + connection.callId + "/socket", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const current = new WebSocket(url);
    current.binaryType = "arraybuffer";
    socket = current;
    let ready = false;
    const deadline = setTimeout(() => current.close(), 10_000);
    current.onopen = () =>
      current.send(JSON.stringify({ type: "authenticate", ticket: connection.ticket }));
    current.onmessage = (message) => {
      if (closed || current !== socket) return;
      if (message.data instanceof ArrayBuffer) {
        if (pendingAudio !== undefined) options.audio(message.data, pendingAudio);
        pendingAudio = undefined;
        return;
      }
      try {
        const event = JSON.parse(String(message.data)) as VoiceServerEvent;
        if (event.type === "ready") {
          ready = true;
          failures = 0;
          disconnectedAt = 0;
          clearTimeout(deadline);
          options.ready();
        }
        if (event.type === "audio") pendingAudio = event.generation;
        else options.event(event);
      } catch {
        current.close(1002);
      }
    };
    current.onclose = () => {
      clearTimeout(deadline);
      if (closed || current !== socket) return;
      socket = undefined;
      pendingAudio = undefined;
      options.disconnected();
      retry(connection, ready);
    };
    current.onerror = () => current.close();
  };
  const close = () => {
    closed = true;
    clearTimeout(timer);
    socket?.close();
    options.signal.removeEventListener("abort", close);
  };
  options.signal.addEventListener("abort", close, { once: true });
  open(options.connection);
  return {
    send: (event) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
    },
    pcm: (bytes) => {
      if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 64_000) return false;
      socket.send(bytes);
      return true;
    },
    close,
  };
};
