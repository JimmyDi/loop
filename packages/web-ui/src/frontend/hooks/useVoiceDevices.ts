import { useEffect, useState } from "react";

import { saveVoiceDevice, voiceDevice } from "../voice/device";
import type { VoiceDevicesControl } from "./voice-devices-types";

export const useVoiceDevices = (): VoiceDevicesControl => {
  const [selected, setSelected] = useState(voiceDevice);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let active = true;
    const media = navigator.mediaDevices;
    const refresh = () => {
      void media
        ?.enumerateDevices()
        .then((values) => {
          if (active) setDevices(values.filter((device) => device.kind === "audioinput"));
        })
        .catch(() => {});
    };
    refresh();
    media?.addEventListener("devicechange", refresh);
    window.addEventListener("loop-voice-permission", refresh);
    return () => {
      active = false;
      media?.removeEventListener("devicechange", refresh);
      window.removeEventListener("loop-voice-permission", refresh);
    };
  }, []);
  return {
    devices,
    selected,
    select: (id: string) => {
      saveVoiceDevice(id);
      setSelected(id);
    },
  };
};
