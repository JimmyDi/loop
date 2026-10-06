import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api";

export const useDirectoryPicker = (onSelected: (path: string) => void) => {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<unknown>();
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);

  const pick = async () => {
    if (controller.current) return;

    const request = new AbortController();

    controller.current = request;
    setPicking(true);
    setError(undefined);

    try {
      const result = await api<{ path: string | null }>("/directories/pick", {
        method: "POST",
        signal: request.signal,
      });

      if (result.path && !request.signal.aborted) onSelected(result.path);
    } catch (error) {
      if (!request.signal.aborted) {
        setError(error);
      }
    } finally {
      controller.current = undefined;
      setPicking(false);
    }
  };

  return { picking, error, pick };
};
