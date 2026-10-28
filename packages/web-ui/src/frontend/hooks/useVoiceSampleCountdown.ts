import { useEffect, useRef, useState } from "react";

export const useVoiceSampleCountdown = (
  recording: boolean,
  listening: boolean,
  finish: () => Promise<void>,
  durationSeconds = 30,
): number | undefined => {
  const [remaining, setRemaining] = useState<number>();
  const deadline = useRef<number | undefined>(undefined);
  const finishCurrent = useRef(finish);
  finishCurrent.current = finish;
  useEffect(() => {
    if (!recording) {
      deadline.current = undefined;
      setRemaining(undefined);
      return;
    }
    if (deadline.current === undefined) {
      if (!listening) return;
      deadline.current = Date.now() + durationSeconds * 1000;
    }
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 250);
    const timer = setTimeout(
      () => {
        setRemaining(0);
        void finishCurrent.current();
      },
      Math.max(0, deadline.current - Date.now()),
    );
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [recording, listening, durationSeconds]);
  return remaining;
};
