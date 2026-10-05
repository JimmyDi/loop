import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import { once } from "node:events";

export const createHttpServer = (fetch: (request: Request) => Response | Promise<Response>) =>
  createServer(getRequestListener(fetch));

export const listen = async (server: ReturnType<typeof createHttpServer>, port: number) => {
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing HTTP listener");
  return new URL("http://127.0.0.1:" + address.port + "/");
};
