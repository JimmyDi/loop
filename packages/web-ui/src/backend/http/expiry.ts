/** Node timers cannot represent the full lifetime of a persistent login. */
export const onExpiry = (expiresAt: number, expire: () => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    timer.unref();
  };
  schedule();
  return () => clearTimeout(timer);
};
