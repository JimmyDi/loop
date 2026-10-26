import { create } from "zustand";

import { readPreference, writePreference } from "../lib/preferences";
import { readVoiceDevice, writeVoiceDevice } from "./device-storage";
import type { VoiceSetupPreference, VoiceSetupState } from "./setup-state-types";

const KEY = "voice.setup";

const validPreference = (value: unknown): value is VoiceSetupPreference => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  return (
    Object.keys(fields).every((key) => key === "profile" || key === "verifiedSignature") &&
    (fields.profile === "input" || fields.profile === "conversation") &&
    (fields.verifiedSignature === undefined ||
      (typeof fields.verifiedSignature === "string" &&
        fields.verifiedSignature.length > 0 &&
        fields.verifiedSignature.length <= 16384))
  );
};

const saved = readPreference<unknown>(KEY, undefined);

const initial: VoiceSetupPreference = validPreference(saved) ? saved : { profile: "conversation" };

export const useVoiceSetupState = create<VoiceSetupState>((set, get) => {
  const persist = (preference: VoiceSetupPreference): void => writePreference(KEY, preference);
  return {
    ...initial,
    deviceId: readVoiceDevice(),
    setProfile: (profile) => {
      if (get().profile === profile) return;
      persist({ profile });
      set({ profile, verifiedSignature: undefined });
    },
    setDevice: (deviceId) => {
      if (get().deviceId === deviceId) return;
      writeVoiceDevice(deviceId);
      persist({ profile: get().profile });
      set({ deviceId, verifiedSignature: undefined });
    },
    verify: (verifiedSignature) => {
      if (!verifiedSignature || verifiedSignature.length > 16384) return;
      persist({ profile: get().profile, verifiedSignature });
      set({ verifiedSignature });
    },
    clearVerification: () => {
      if (get().verifiedSignature === undefined) return;
      persist({ profile: get().profile });
      set({ verifiedSignature: undefined });
    },
  };
});
