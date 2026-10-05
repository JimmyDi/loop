export const readPreference = <T>(key: string, fallback: T): T => {
  try {
    const value = globalThis.localStorage?.getItem("loop.web." + key);

    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writePreference = (key: string, value: unknown): void => {
  try {
    globalThis.localStorage?.setItem("loop.web." + key, JSON.stringify(value));
  } catch {
    // Private browsing or a full storage quota must not interrupt a conversation.
  }
};
