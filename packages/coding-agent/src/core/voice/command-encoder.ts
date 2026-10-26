import { decodeVoiceSamples } from "./audio-codec";
import { MAX_VOICE_FRAME_BYTES } from "./protocol-constants";
import { validVoiceId } from "./protocol-identifiers";
import type { VoiceCommand } from "./protocol-types";

export const encodeVoiceCommand = (command: VoiceCommand): string => {
  if (command.v !== 1 || !validVoiceId(command.id)) throw new Error("voice_invalid_command");
  if (command.type === "audio") decodeVoiceSamples(command.samples);
  if (
    command.type === "synthesize" &&
    (typeof command.text !== "string" ||
      !command.text.trim() ||
      Buffer.byteLength(command.text) > 16 * 1024 ||
      (command.speaker !== undefined &&
        (!Number.isSafeInteger(command.speaker) || command.speaker < 0)))
  )
    throw new Error("voice_invalid_text");
  if (command.type === "cancel" && !validVoiceId(command.targetId))
    throw new Error("voice_invalid_command");
  const encoded = JSON.stringify(command);
  if (Buffer.byteLength(encoded) > MAX_VOICE_FRAME_BYTES) throw new Error("voice_frame_too_large");
  return encoded + "\n";
};
