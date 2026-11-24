import { createServer, request as httpRequest } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";

export type UpdateState = { phase: string; version?: string; message?: string; progress?: number };

export const createGateway = async (options: {
  backend: string | (() => string | undefined);
  frontend?: string;
  token: string;
  port: number;
  assets: string;
  state: () => UpdateState;
  action: (action: "stop") => void;
}) => {
  const target = (path: string) => {
    const backend = typeof options.backend === "function" ? options.backend() : options.backend;
    const address = options.frontend && !path.startsWith("/api/") ? options.frontend : backend;
    return address ? new URL(address) : undefined;
  };
  const equal = (value: string) => {
    const actual = Buffer.from(value);
    const expected = Buffer.from(options.token);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  const authenticated = (cookie = "") =>
    cookie
      .split(";")
      .some(
        (value) =>
          value.trim().startsWith("loop_desktop=") &&
          equal(value.trim().slice("loop_desktop=".length)),
      );
  const server = createServer(async (incoming, response) => {
    try {
      const host = "127.0.0.1:" + (server.address() as { port: number }).port;
      const origin = "http://" + host;
      if (
        incoming.headers.host !== host ||
        (incoming.headers.origin && incoming.headers.origin !== origin) ||
        incoming.headers["sec-fetch-site"] === "cross-site"
      ) {
        response.writeHead(403).end();
        return;
      }
      const url = new URL(incoming.url ?? "/", origin);
      if (url.origin !== origin) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      if (url.pathname === "/__desktop/bootstrap" && equal(url.searchParams.get("token") ?? "")) {
        response.setHeader(
          "Set-Cookie",
          "loop_desktop=" + options.token + "; HttpOnly; SameSite=Strict; Path=/",
        );
        response.writeHead(303, { Location: "/" }).end();
        return;
      }
      if (!authenticated(incoming.headers.cookie)) {
        response.writeHead(401).end();
        return;
      }
      if (url.pathname.startsWith("/__desktop/")) {
        if (url.pathname === "/__desktop/state" && incoming.method === "GET") {
          response
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify(options.state()));
        } else if (url.pathname === "/__desktop/stop" && incoming.method === "POST") {
          options.action("stop");
          response.writeHead(202).end();
        } else if (
          ["/__desktop/client.js", "/__desktop/client.css"].includes(url.pathname) &&
          incoming.method === "GET"
        ) {
          const css = url.pathname.endsWith("css");
          response.writeHead(200, { "Content-Type": css ? "text/css" : "text/javascript" });
          response.end(await readFile(join(options.assets, css ? "client.css" : "client.js")));
        } else response.writeHead(404).end();
        return;
      }
      const backend = target(url.pathname);
      if (!backend) {
        response.writeHead(503, { "Retry-After": "1" }).end();
        return;
      }
      const headers = {
        ...incoming.headers,
        host: backend.host,
        origin: backend.origin,
        "x-loop-desktop": options.token,
      };
      delete headers.cookie;
      const upstream = httpRequest(
        new URL(url.pathname + url.search, backend.origin),
        {
          method: incoming.method,
          headers,
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers);
          result.pipe(response);
          response.on("close", () => result.destroy());
        },
      );
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      incoming.pipe(upstream);
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  server.on("upgrade", (incoming, socket, head) => {
    const host = "127.0.0.1:" + (server.address() as { port: number }).port;
    const origin = "http://" + host;
    const url = URL.parse(incoming.url ?? "/", origin);
    if (
      !url ||
      incoming.headers.host !== host ||
      incoming.headers.origin !== origin ||
      url.origin !== origin ||
      !authenticated(incoming.headers.cookie)
    ) {
      socket.destroy();
      return;
    }
    const backend = target(url.pathname);
    if (!backend) {
      socket.destroy();
      return;
    }
    const upstream = httpRequest(new URL(url.pathname + url.search, backend.origin), {
      headers: {
        ...incoming.headers,
        cookie: "",
        host: backend.host,
        origin: backend.origin,
        "x-loop-desktop": options.token,
      },
    });
    upstream.on("upgrade", (result, peer, extra) => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          Object.entries(result.headers)
            .map(([key, value]) => key + ": " + value)
            .join("\r\n") +
          "\r\n\r\n",
      );
      if (head.length) peer.write(head);
      if (extra.length) socket.write(extra);
      socket.pipe(peer).pipe(socket);
      socket.on("error", () => peer.destroy());
      peer.on("error", () => socket.destroy());
      socket.on("close", () => peer.destroy());
      peer.on("close", () => socket.destroy());
    });
    upstream.on("error", () => socket.destroy());
    upstream.on("response", (response) => {
      response.resume();
      socket.destroy();
    });
    upstream.end();
  });
  server.listen(options.port, "127.0.0.1");
  await once(server, "listening");
  return server;
};
