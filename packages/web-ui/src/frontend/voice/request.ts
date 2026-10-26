import { api } from "../lib/api";
import type { VoiceRequestOptions } from "./request-types";

export const voiceCommand = async <T>(
  path: string,
  body: unknown,
  options: VoiceRequestOptions = {},
): Promise<T> => {
  const deadline = new AbortController();
  const timeout = setTimeout(
    () => deadline.abort(new Error("voice_connection_timeout")),
    options.timeout ?? 10_000,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline.signal])
    : deadline.signal;
  try {
    return await api<T>(path, { method: "POST", body: JSON.stringify(body), signal });
  } finally {
    clearTimeout(timeout);
  }
};
