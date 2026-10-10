import { useEffect, useState } from "react";

export const useElapsedTime = (startedAt?: number, finishedAt?: number) => {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (startedAt === undefined || finishedAt !== undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, finishedAt]);

  const seconds = Math.max(0, Math.floor(((finishedAt ?? now) - (startedAt ?? now)) / 1000));
  const duration = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return { seconds, duration };
};
