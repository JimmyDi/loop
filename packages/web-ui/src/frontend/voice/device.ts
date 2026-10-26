const KEY = "loop.voice.microphone";

export const voiceDevice = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export const saveVoiceDevice = (id: string): void => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* Capture still works with the default device when storage is unavailable. */
  }
};
