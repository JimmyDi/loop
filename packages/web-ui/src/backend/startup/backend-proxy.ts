import { restartingResponse } from "../http/restarting-response";

export const createBackendProxy =
  (target: () => { port: number; token: string } | undefined) =>
  async (request: Request): Promise<Response> => {
    const backend = target();
    if (!backend) return restartingResponse(request);
    const url = new URL(request.url);
    url.protocol = "http:";
    url.hostname = "127.0.0.1";
    url.port = String(backend.port);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cookie");
    headers.set("authorization", "Bearer " + backend.token);
    headers.set("accept-encoding", "identity");
    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body,
        duplex: "half",
        signal: request.signal,
        redirect: "manual",
      } as RequestInit);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
      return restartingResponse(request);
    }
  };
