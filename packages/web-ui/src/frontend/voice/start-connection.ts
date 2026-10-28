import type { VoiceConnection } from "../../shared/voice";
import type { VoiceClientOptions } from "./client-types";
import { voiceCommand } from "./request";

export const startConnection = async (
  options: VoiceClientOptions,
  clientId: string,
  signal: AbortSignal,
): Promise<VoiceConnection> => {
  await options.waitForClose;
  signal.throwIfAborted();
  const connection = await voiceCommand<VoiceConnection>(
    "/voice/calls",
    { sessionId: options.sessionId, mode: options.mode, synthesis: options.synthesis, clientId },
    { signal, timeout: 40_000 },
  );
  if (signal.aborted) {
    await voiceCommand("/voice/calls/" + connection.callId + "/close", { clientId }).catch(
      () => {},
    );
    signal.throwIfAborted();
  }
  return connection;
};
