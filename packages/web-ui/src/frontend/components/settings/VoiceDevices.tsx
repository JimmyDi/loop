import { useTranslation } from "react-i18next";

import { useVoiceDevices } from "../../hooks/useVoiceDevices";
import type { VoiceDevicesProps } from "./voice-devices-types";
import "./VoiceDevices.css";

export const VoiceDevices = ({ onChange }: VoiceDevicesProps) => {
  const { t } = useTranslation();
  const { devices, selected, select } = useVoiceDevices();
  return (
    <div className="voice-devices">
      <label>
        <span>{t("voice.inputDevice")}</span>
        <select
          value={devices.some((device) => device.deviceId === selected) ? selected : ""}
          onChange={(event) => {
            select(event.target.value);
            onChange?.(event.target.value);
          }}
        >
          <option value="">{t("voice.defaultDevice")}</option>
          {devices
            .filter((device) => device.deviceId && device.deviceId !== "default")
            .map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || t("voice.unnamedDevice", { index: index + 1 })}
              </option>
            ))}
        </select>
      </label>
      <small>{t("voice.deviceHint")}</small>
    </div>
  );
};
