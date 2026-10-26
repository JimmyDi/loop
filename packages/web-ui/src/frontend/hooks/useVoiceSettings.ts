import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { VoiceInstallCommand, VoiceStatus } from "../../shared/voice";
import { command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";
import type { VoiceSettingsControl } from "./voice-settings-types";
import { useVoiceStatus } from "./useVoiceStatus";
import { useVoiceSetupState } from "../voice/setup-state";

export const useVoiceSettings = (): VoiceSettingsControl => {
  const client = useQueryClient();
  const action = useAsyncAction();
  const [requested, setRequested] = useState<VoiceInstallCommand["action"]>();
  const query = useVoiceStatus();
  const execute = (value: VoiceInstallCommand) =>
    action.run(async () => {
      setRequested(value.action);
      if (value.action !== "cancel") useVoiceSetupState.getState().clearVerification();
      try {
        const status = await command<VoiceStatus>("/voice/install", value);
        client.setQueryData(["voice-status"], status);
      } finally {
        setRequested(undefined);
        void client.invalidateQueries({ queryKey: ["voice-status"] });
      }
    });
  useEffect(() => {
    if (
      !query.data?.error &&
      (query.data?.installed ||
        ["installing", "updating", "uninstalling"].includes(query.data?.phase ?? ""))
    )
      action.clearError();
  }, [query.data?.installed, query.data?.error, query.data?.phase]);
  return { query, execute, pending: action.pending, requested, error: action.error };
};
