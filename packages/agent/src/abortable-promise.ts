export const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("Run cancelled"));

    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });

    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
};
