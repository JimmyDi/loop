import { createHttpServer, listen } from "../http/node-server";
import { HttpError } from "../http/errors";
import { staticResponse } from "../http/static-files";
import { deviceCookie, readCredential } from "./device-credentials";
import type { RemoteDevices } from "./remote-devices";
import { assertRemoteOrigin, allowsRemoteBusiness } from "./remote-policy";
import { remotePairingRoutes } from "./remote-pairing-routes";
import { remoteResponse } from "./remote-response";

export const createRemoteHandler =
  (
    devices: RemoteDevices,
    business: (request: Request) => Promise<Response>,
    assets: string,
    localHost: () => string,
  ) =>
  async (request: Request): Promise<Response> => {
    try {
      const origin = devices.origin;
      if (!origin) throw new HttpError(503, "remote_unavailable");
      const url = new URL(request.url);
      const host = request.headers.get("host") ?? url.host;
      if (![new URL(origin).host, localHost()].includes(host))
        throw new HttpError(403, "invalid_host");
      assertRemoteOrigin(request, origin);
      const pairing = await remotePairingRoutes(request, devices);
      let response = pairing;
      if (!response && url.pathname.startsWith("/api/")) {
        const credential = readCredential(request, deviceCookie);
        const device = devices.authenticate(credential);
        if (!allowsRemoteBusiness(url.pathname, request.method))
          throw new HttpError(403, "local_only");
        if (
          !["GET", "HEAD"].includes(request.method) &&
          request.headers.get("x-loop-csrf") !== devices.csrf(credential)
        )
          throw new HttpError(403, "invalid_csrf");
        const abort = new AbortController();
        const release = devices.track(device, abort);
        const signal = AbortSignal.any([request.signal, abort.signal]);
        try {
          const result = await business(new Request(request, { signal }));
          if (signal.aborted) {
            await result.body?.cancel();
            throw new HttpError(401, "device_unauthorized");
          }
          response = remoteResponse(result, signal, release);
        } catch (error) {
          release();
          throw error;
        }
      }
      if (!response) {
        response = await staticResponse(request, assets);
        if (
          response.headers.get("content-type")?.startsWith("text/html") &&
          response.ok &&
          request.method === "GET"
        ) {
          const html = (await response.text()).replace(
            "<head>",
            '<head><meta name="loop-remote" content="1">',
          );
          response = new Response(html, { headers: response.headers });
        }
      }
      const streaming = response.headers.get("Content-Type")?.startsWith("text/event-stream");
      response.headers.set("Cache-Control", streaming ? "no-store, no-transform" : "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
      return response;
    } catch (error) {
      const known = error instanceof HttpError;
      return Response.json(
        { code: known ? error.code : "remote_operation_failed" },
        {
          status: known ? error.status : 500,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  };

export const startRemoteIngress = async (
  devices: RemoteDevices,
  business: (request: Request) => Promise<Response>,
  assets: string,
) => {
  let localHost = "";
  const server = createHttpServer(createRemoteHandler(devices, business, assets, () => localHost));
  try {
    const address = await listen(server, 0);
    localHost = address.host;
    let closing: Promise<void> | undefined;
    return {
      port: Number(address.port),
      connected: (origin: string) => devices.connect(origin),
      close: () =>
        (closing ??= new Promise<void>((resolve, reject) => {
          devices.connect();
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        })),
    };
  } catch (error) {
    server.close();
    throw error;
  }
};
