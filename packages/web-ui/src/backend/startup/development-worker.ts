import { timingSafeEqual } from "node:crypto";

import { createHttpServer, listen } from "../http/node-server";
import { errorResponse } from "../http/errors";
import { createBusinessService } from "./business-service";
import { readContext } from "../http/business-context";
import { attachVoiceUpgrade } from "../http/voice-upgrade";

// The supervisor sends this ephemeral capability only over its private IPC channel.
process.once("message", async (message: { token: string; invalidated?: string[] }) => {
  if (typeof message?.token !== "string" || message.token.length !== 64) process.exit(1);
  const service = createBusinessService();
  process.on("message", (value: unknown) => {
    if (
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "voice.revoke" &&
      "principal" in value &&
      typeof value.principal === "string"
    ) {
      const requestId = "requestId" in value ? value.requestId : undefined;
      void service.voice
        .revoke(value.principal)
        .then(() => {
          if (typeof requestId === "string" && process.connected)
            process.send?.({ type: "voice.revoked", requestId }, () => {});
        })
        .catch(() => process.exit(1));
    }
  });
  if (message.invalidated) {
    if (
      !Array.isArray(message.invalidated) ||
      message.invalidated.some((id) => typeof id !== "string")
    )
      process.exit(1);
    for (const principal of message.invalidated) await service.voice.revoke(principal);
  }
  const server = createHttpServer(async (request) => {
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from("Bearer " + message.token);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return new Response(null, { status: 403 });
    try {
      const response = await service.handle(request, readContext(request.headers));
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      return errorResponse(error);
    }
  });
  const closeVoice = attachVoiceUpgrade(
    server,
    (request) => {
      const actual = Buffer.from(request.headers.get("authorization") ?? "");
      const expected = Buffer.from("Bearer " + message.token);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        throw new Error("voice_unauthorized");
      return readContext(request.headers);
    },
    service.voice.connect,
  );
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    closeVoice();
    server.closeAllConnections();
    server.close();
    void service.close().finally(() => process.exit());
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
  process.on("disconnect", close);
  const address = await listen(server, 0);
  process.send?.({ port: Number(address.port) });
});
