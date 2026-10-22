/** Keep an authenticated stream tied to its device and request lifecycle. */
export const remoteResponse = (
  response: Response,
  signal: AbortSignal,
  release: () => void,
): Response => {
  if (!response.body) {
    release();
    return response;
  }
  const reader = response.body.getReader();
  let closed = false;
  let finish = (_cancelled = false) => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      finish = (cancelled = false) => {
        if (closed) return;
        closed = true;
        release();
        signal.removeEventListener("abort", abort);
        void reader.cancel().catch(() => {});
        if (!cancelled) controller.close();
      };
      const abort = () => finish();
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) finish();
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (closed) return;
        if (result.done) finish();
        else controller.enqueue(result.value);
      } catch {
        finish();
      }
    },
    cancel() {
      finish(true);
    },
  });
  return new Response(body, { status: response.status, headers: response.headers });
};
