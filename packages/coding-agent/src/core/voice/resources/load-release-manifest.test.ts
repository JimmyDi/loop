import { afterEach, expect, test, vi } from "vitest";

import { sourceVoiceModels, VOICE_ENGINE_VERSION } from "./catalog";
import { resolveVoiceEngine } from "./engine-resolution";
import { loadReleaseManifest } from "./load-release-manifest";
import { validateReleaseManifest } from "./release-manifest";
import { voiceReleaseBase, VOICE_RELEASE_VERSION } from "./release-version";
import type { VoiceComponent, VoiceResourceOperationState } from "./resource-types";

afterEach(() => vi.unstubAllGlobals());

const fixture = () => {
  const engine: VoiceComponent = {
    id: "loop-voice-darwin-arm64",
    kind: "engine",
    name: "Synthetic engine",
    version: VOICE_ENGINE_VERSION,
    license: "MIT",
    files: [{ path: "loop-voice", bytes: 1, sha256: "a".repeat(64), executable: true, url: "" }],
  };
  const archive = (component: VoiceComponent) => ({
    ...component,
    archive: {
      url: voiceReleaseBase() + component.id + ".tar.gz",
      bytes: 1,
      sha256: "b".repeat(64),
      expandedBytes: component.files.reduce((sum, file) => sum + file.bytes, 0),
    },
  });
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    version: VOICE_RELEASE_VERSION,
    engines: { "darwin-arm64": archive(engine) },
    models: Object.fromEntries(sourceVoiceModels.map((model) => [model.id, archive(model)])),
  };
};

test("loads a predictable versioned manifest and validates pinned model identities", async () => {
  const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify(fixture())));
  vi.stubGlobal("fetch", fetcher);
  const manifest = await loadReleaseManifest();
  expect(fetcher.mock.calls[0]?.[0]).toBe(voiceReleaseBase() + "manifest.json");
  expect(manifest.models[sourceVoiceModels[0]!.id]?.files[0]?.url).toBe("");
  expect(manifest.engines["darwin-arm64"]?.archive?.url).toBe(
    voiceReleaseBase() + "loop-voice-darwin-arm64.tar.gz",
  );
});

test.each([
  (value: ReturnType<typeof fixture>) => {
    value.protocolVersion = 2;
  },
  (value: ReturnType<typeof fixture>) => {
    value.version = "2.0.0";
  },
  (value: ReturnType<typeof fixture>) => {
    value.engines["darwin-arm64"].archive.url = "https://example.test/engine.tar.gz";
  },
  (value: ReturnType<typeof fixture>) => {
    value.models[sourceVoiceModels[0]!.id]!.files = [];
  },
  (value: ReturnType<typeof fixture>) => {
    value.engines["darwin-arm64"].files[0]!.path = "../escape";
  },
])("rejects incompatible, redirected or malformed resource definitions", (mutate) => {
  const value = fixture();
  mutate(value);
  expect(() => validateReleaseManifest(value, VOICE_RELEASE_VERSION)).toThrow(
    "voice_release_manifest_invalid",
  );
});

test("bounds manifest response size and reports unpublished releases", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("x".repeat(1024 * 1024 + 1))),
  );
  await expect(loadReleaseManifest()).rejects.toThrow("voice_release_manifest_invalid");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  await expect(loadReleaseManifest()).rejects.toThrow("voice_release_unavailable");
});

test("resource discovery uses the manifest and caches repeated status resolution", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture())));
  vi.stubGlobal("fetch", fetcher);
  const state: VoiceResourceOperationState = { phase: "idle" };
  await resolveVoiceEngine("missing-synthetic-voice-directory", state);
  expect(state.release?.version).toBe(VOICE_RELEASE_VERSION);
  await resolveVoiceEngine("missing-synthetic-voice-directory", state);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
