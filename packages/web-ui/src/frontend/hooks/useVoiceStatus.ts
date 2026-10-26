import { useQuery } from "@tanstack/react-query";

import type { VoiceStatus } from "../../shared/voice";
import { api } from "../lib/api";

export const useVoiceStatus = () =>
  useQuery({
    queryKey: ["voice-status"],
    queryFn: () => api<VoiceStatus>("/voice/status"),
    retry: false,
    refetchInterval: (query) =>
      ["installing", "updating", "uninstalling"].includes(query.state.data?.phase ?? "")
        ? 750
        : false,
  });
