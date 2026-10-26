// Bump major for incompatible contracts, minor for compatible features/models, patch for fixes.
export const VOICE_RELEASE_VERSION = "1.0.0";

export const voiceReleaseBase = (version = VOICE_RELEASE_VERSION): string => {
  if (!/^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$/.test(version))
    throw new Error("voice_release_version_invalid");
  return "https://github.com/JimmyDi/loop/releases/download/voice-v" + version + "/";
};
