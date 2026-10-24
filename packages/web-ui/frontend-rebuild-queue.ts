export const createFrontendRebuildQueue = (
  build: () => Promise<void>,
  failed: (error: unknown) => void,
) => {
  let stopped = false;
  let queued = false;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    queued = true;
    if (running) return running;
    running = (async () => {
      while (queued && !stopped) {
        queued = false;
        try {
          await build();
        } catch (error) {
          failed(error);
        }
      }
    })().finally(() => {
      running = undefined;
    });
    return running;
  };
  return {
    run,
    schedule: () => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), 500);
    },
    close: async () => {
      stopped = true;
      queued = false;
      clearTimeout(timer);
      await running;
    },
  };
};
