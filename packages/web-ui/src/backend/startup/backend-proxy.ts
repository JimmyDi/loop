import { restartingResponse } from "../http/restarting-response";
import { localContext, writeContext } from "../http/business-context";
import type { BusinessHandler } from "../http/business-context";

export const createBackendProxy = (target: () => { port: number; token: string } | undefined) =>
  (async (request, context = localContext): Promise<Response> => {
    const backend = target();
    if (!backend) return restartingResponse(request);
    const url = new URL(request.url);
    url.protocol = "http:";
    url.hostname = "127.0.0.1";
    url.port = String(backend.port);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cookie");
    writeContext(headers, { ...context, origin: context.origin ?? new URL(request.url).origin });
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
      const reader = response.body?.getReader();
      const eventStream =
        response.headers.get("content-type")?.split(";")[0]?.trim() === "text/event-stream";
      let cancelled = false;
      const body = reader
        ? new ReadableStream<Uint8Array>({
            async pull(controller) {
              try {
                const chunk = await reader.read();
                if (cancelled) return;
                if (chunk.done) controller.close();
                else controller.enqueue(chunk.value);
              } catch (error) {
                if (cancelled) return;
                // A browser reload cancels the upstream fetch as well as its response stream.
                // Worker replacement intentionally disconnects SSE; EOF triggers browser recovery.
                if (request.signal.aborted || (eventStream && target()?.token !== backend.token))
                  controller.close();
                else controller.error(error);
              }
            },
            cancel(reason) {
              cancelled = true;
              return reader.cancel(reason).catch(() => {});
            },
          })
        : null;
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (request.signal.aborted) throw error;
      return restartingResponse(request);
    }
  }) satisfies BusinessHandler;
