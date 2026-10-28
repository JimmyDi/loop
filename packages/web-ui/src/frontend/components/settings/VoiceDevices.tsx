import { useTranslation } from "react-i18next";

import { useVoiceDevices } from "../../hooks/useVoiceDevices";
import type { VoiceDevicesProps } from "./voice-devices-types";
import { VoiceSelect } from "./VoiceSelect";
import "./VoiceDevices.css";

export const VoiceDevices = ({ onChange }: VoiceDevicesProps) => {
  const { t } = useTranslation();
  const { devices, selected, select } = useVoiceDevices();
  const options = [
    { value: "", name: t("voice.defaultDevice") },
    ...devices
      .filter((device) => device.deviceId && device.deviceId !== "default")
      .map((device, index) => ({
        value: device.deviceId,
        name: device.label || t("voice.unnamedDevice", { index: index + 1 }),
      })),
  ];
  return (
    <div className="voice-devices">
      <div className="voice-device-field">
        <span className="voice-device-label">{t("voice.inputDevice")}</span>
        <VoiceSelect
          label={t("voice.inputDevice")}
          value={options.some((option) => option.value === selected) ? selected : ""}
          options={options}
          onChange={(value) => {
            select(value);
            onChange?.(value);
          }}
        />
      </div>
    </div>
  );
};
