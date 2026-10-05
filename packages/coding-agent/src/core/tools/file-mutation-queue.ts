import { canonicalPath } from "../permissions/paths";

const pending = new Map<string, Promise<unknown>>();

export async function withFileMutationQueue<T>(
  path: string,
  work: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  const key = await canonicalPath(path);
  const previous = pending.get(key);
  let started = false;
  const next = (previous ?? Promise.resolve())
    .catch(() => {})
    .then(() => {
      signal?.throwIfAborted();
      started = true;
      return work();
    });

  pending.set(key, next);

  const cleanup = () => {
    if (pending.get(key) === next) pending.delete(key);
  };
  void next.then(cleanup, cleanup);
  if (!signal) return next;

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      // Once mutation starts, wait for its cleanup before reporting completion.
      if (!started) reject(signal.reason ?? new Error("Mutation cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    void next.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
