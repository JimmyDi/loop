import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { VoiceTestStepProps } from "./voice-test-step-types";
import type { VoiceTestState } from "./voice-test-types";
import { VoiceDevices } from "./VoiceDevices";
import { VoiceSetupStep } from "./VoiceSetupStep";
import { VoiceTest } from "./VoiceTest";
import "./VoiceTestStep.css";

export const VoiceTestStep = ({ ready, speechReady }: VoiceTestStepProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<VoiceTestState>("idle");
  const [device, setDevice] = useState("");
  return (
    <VoiceSetupStep
      number={3}
      title={t("voice.testSetup")}
      complete={ready && state === "verified"}
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
        }}
      />
      <VoiceTest
        key={device}
        disabled={!ready}
        speechDisabled={!speechReady}
        onStateChange={setState}
      />
    </VoiceSetupStep>
  );
};
