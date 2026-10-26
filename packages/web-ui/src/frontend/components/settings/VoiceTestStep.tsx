import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceTestStepProps } from "./voice-test-step-types";
import type { VoiceTestState } from "./voice-test-types";
import { VoiceDevices } from "./VoiceDevices";
import { VoiceSetupStep } from "./VoiceSetupStep";
import { VoiceTest } from "./VoiceTest";
import "./VoiceTestStep.css";

export const VoiceTestStep = ({
  ready,
  speechReady,
  verified = false,
  onVerified,
  onReset,
}: VoiceTestStepProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceTestState>(verified ? "verified" : "idle");
  const [device, setDevice] = useState("");
  const update = useCallback(
    (next: VoiceTestState) => {
      setState(next);
      if (next === "verified") onVerified?.();
      else onReset?.();
    },
    [onVerified, onReset],
  );
  return (
    <VoiceSetupStep
      number={3}
      title={t("voice.testSetup")}
      complete={ready && (onVerified ? verified : state === "verified")}
      loading={ready && state === "loading"}
      failed={ready && state === "failed"}
    >
      <small className="voice-test-step-hint">
        {t(ready ? "voice.testHint" : "voice.testLocked")}
      </small>
      <VoiceDevices
        onChange={(value) => {
          setState("idle");
          setDevice(value);
          onReset?.();
        }}
      />
      <VoiceTest
        key={device}
        disabled={!ready}
        speechDisabled={!speechReady}
        onStateChange={update}
      />
    </VoiceSetupStep>
  );
};
