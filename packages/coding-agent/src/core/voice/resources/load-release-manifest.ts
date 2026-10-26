import { validateReleaseManifest } from "./release-manifest";
import type { VoiceReleaseManifest } from "./release-manifest-types";
import { voiceReleaseBase, VOICE_RELEASE_VERSION } from "./release-version";

export const loadReleaseManifest = async (signal?: AbortSignal): Promise<VoiceReleaseManifest> => {
  const active = AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]);
  const response = await fetch(voiceReleaseBase() + "manifest.json", { signal: active });
  if (!response.ok || !response.body) throw new Error("voice_release_unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 1024 * 1024) throw new Error("voice_release_manifest_invalid");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return validateReleaseManifest(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
    VOICE_RELEASE_VERSION,
  );
};
