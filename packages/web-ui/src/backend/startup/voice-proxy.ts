import { WebSocket } from "ws";
import type { RawData } from "ws";

import type { VoiceUpgradeHandler } from "../http/voice-upgrade-types";
import { writeContext } from "../http/business-context";
import type { VoiceProxyFrame, VoiceProxyTarget } from "./voice-proxy-types";

export const createVoiceProxy =
  (target: () => VoiceProxyTarget | undefined): VoiceUpgradeHandler =>
  (client, callId, context) => {
    const backend = target();
    if (!backend) {
      client.close(1013, "backend_restarting");
      return;
    }
    const headers = new Headers({ authorization: "Bearer " + backend.token });
    writeContext(headers, context);
    const upstream = new WebSocket(
      "ws://127.0.0.1:" + backend.port + "/api/voice/calls/" + callId + "/socket",
      {
        headers: Object.fromEntries(headers),
        perMessageDeflate: false,
        autoPong: false,
        maxPayload: 4_100_000,
      },
    );
    const queued: VoiceProxyFrame[] = [];
    let bytes = 0;
    const forward = (destination: WebSocket, data: RawData, binary: boolean) => {
      if (destination.readyState !== WebSocket.OPEN || destination.bufferedAmount > 2_000_000) {
        client.close(1013, "voice_transport_overloaded");
        upstream.terminate();
        return;
      }
      destination.send(data, { binary });
    };
    client.on("message", (data, binary) => {
      if (upstream.readyState === WebSocket.CONNECTING) {
        bytes += Array.isArray(data)
          ? data.reduce((size, part) => size + part.length, 0)
          : data.byteLength;
        if (bytes > 65_536) {
          client.close(1013, "voice_transport_overloaded");
          upstream.terminate();
          return;
        }
        queued.push({ data, binary });
      } else forward(upstream, data, binary);
    });
    upstream.once("open", () => {
      if (client.readyState !== WebSocket.OPEN) {
        upstream.close();
        return;
      }
      for (const item of queued) forward(upstream, item.data, item.binary);
      queued.length = 0;
    });
    upstream.on("message", (data, binary) => forward(client, data, binary));
    upstream.on("ping", (data) => {
      if (client.readyState === WebSocket.OPEN) client.ping(data);
    });
    client.on("pong", (data) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.pong(data);
    });
    upstream.on("error", () => {
      client.close(1011, "voice_backend_unavailable");
      upstream.terminate();
    });
    client.once("close", () => {
      queued.length = 0;
      upstream.terminate();
    });
    upstream.once("close", () => client.close(1012, "voice_backend_disconnected"));
  };
