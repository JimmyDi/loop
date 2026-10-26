import { useVoiceSetupState } from "./setup-state";

export const voiceDevice = (): string => useVoiceSetupState.getState().deviceId;

export const saveVoiceDevice = (id: string): void => useVoiceSetupState.getState().setDevice(id);
