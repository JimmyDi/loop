import { useRef, useState } from "react";

export const useAsyncAction = () => {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const run = async (action: () => Promise<unknown>) => {
    if (active.current) return;

    active.current = true;
    setPending(true);
    setError(undefined);

    try {
      await action();
    } catch (error) {
      setError(error);
    } finally {
      active.current = false;
      setPending(false);
    }
  };

  return { pending, error, run };
};
