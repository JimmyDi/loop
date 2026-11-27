import type { SessionSummary } from "../shared/protocol";

export const createScheduledChatCache = (load: () => Promise<SessionSummary | null>) => {
  let cached: { value: SessionSummary | null; expiresAt: number } | undefined;
  let pending: Promise<SessionSummary | null> | undefined;

  const get = (): Promise<SessionSummary | null> => {
    if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.value);
    if (pending) return pending;

    const lookup = load().then((value) => {
      if (pending !== lookup) return get();
      cached = { value, expiresAt: Date.now() + 1000 };
      pending = undefined;
      return value;
    });
    pending = lookup;
    return lookup;
  };

  return {
    get,
    invalidate: () => {
      cached = undefined;
      pending = undefined;
    },
  };
};
