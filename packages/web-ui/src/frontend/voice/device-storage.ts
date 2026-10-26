const KEY = "loop.voice.microphone";

export const readVoiceDevice = (): string => {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    return typeof saved === "string" && saved.length <= 1024 ? saved : "";
  } catch {
    return "";
  }
};

export const writeVoiceDevice = (id: string): void => {
  try {
    globalThis.localStorage?.setItem(KEY, id);
  } catch {
    /* Capture still works with the default device when storage is unavailable. */
  }
};
