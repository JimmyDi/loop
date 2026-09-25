import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DirectoryCapabilities } from "../../shared/protocol";
import { api } from "../lib/api";

export const useDirectoryPicker = (onSelected: (path: string) => void) => {
  const [browsing, setBrowsing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<unknown>();
  const controller = useRef<AbortController | undefined>(undefined);
  const capability = useQuery({
    queryKey: ["directory-capabilities"],
    queryFn: () => api<DirectoryCapabilities>("/directories/capabilities"),
  });

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

      if (result.path) onSelected(result.path);
    } catch (error) {
      if (!request.signal.aborted) {
        setError(error);
        setBrowsing(true);
      }
    } finally {
      controller.current = undefined;
      setPicking(false);
    }
  };

  return { capability, browsing, setBrowsing, picking, error, pick };
};
