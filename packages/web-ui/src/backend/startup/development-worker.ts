import { timingSafeEqual } from "node:crypto";

import { createHttpServer, listen } from "../http/node-server";
import { errorResponse } from "../http/errors";
import { createBusinessService } from "./business-service";

// The supervisor sends this ephemeral capability only over its private IPC channel.
process.once("message", async (message: { token: string }) => {
  if (typeof message?.token !== "string" || message.token.length !== 64) process.exit(1);
  const service = createBusinessService();
  const server = createHttpServer(async (request) => {
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from("Bearer " + message.token);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return new Response(null, { status: 403 });
    try {
      const response = await service.handle(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      return errorResponse(error);
    }
  });
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
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
