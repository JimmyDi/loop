import { McpConnectionError } from "./connection-errors";

export const MCP_SETUP_TIMEOUT_MS = 120_000;

/** Bound discovery even when a connector ignores cancellation; dispose late results separately. */
export const discoverMcp = async <T>(
  lifetime: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
  discard?: (value: T) => void,
  timeoutMs = 15_000,
): Promise<T> => {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([lifetime, timeout]);
  const attempt = Promise.resolve().then(() => {
    signal.throwIfAborted();
    return run(signal);
  });
  void attempt.then(
    (value) => {
      if (signal.aborted) discard?.(value);
    },
    () => {},
  );
  const { promise, reject } = Promise.withResolvers<never>();
  const abort = () => reject(new McpConnectionError("connection_timeout"));
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) abort();
    return await Promise.race([attempt, promise]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
};
