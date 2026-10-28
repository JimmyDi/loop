import { useCallback, useEffect } from "react";

import { useVoiceSetupState } from "../voice/setup-state";
import { voiceSetupSignature } from "../voice/setup-readiness";
import { useVoiceStatus } from "./useVoiceStatus";
import type { VoiceSetupControl } from "./voice-setup-types";

export const useVoiceSetup = (): VoiceSetupControl => {
  const query = useVoiceStatus();
  const setup = useVoiceSetupState();
  const signature = query.isSuccess
    ? voiceSetupSignature(query.data, setup.profile, setup.deviceId)
    : undefined;
  const complete = !!signature && setup.verifiedSignature === signature;
  const verify = useCallback(() => {
    if (signature) setup.verify(signature);
  }, [signature, setup.verify]);
  useEffect(() => {
    if (query.isSuccess && setup.verifiedSignature && setup.verifiedSignature !== signature)
      setup.clearVerification();
  }, [query.isSuccess, signature, setup.verifiedSignature, setup.clearVerification]);
  return {
    ...setup,
    signature,
    complete,
    ready: !!signature,
    verify,
  };
};
