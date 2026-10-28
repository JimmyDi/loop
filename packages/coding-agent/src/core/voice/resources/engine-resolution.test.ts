import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { voicePlatform } from "./catalog";
import { resolveVoiceEngine } from "./engine-resolution";
import { loadReleaseManifest } from "./load-release-manifest";
import type { VoiceReleaseManifest } from "./release-manifest-types";
import type { VoiceResourceOperationState } from "./resource-types";

vi.mock("./load-release-manifest", () => ({ loadReleaseManifest: vi.fn() }));

test("concurrent discovery waits for the same manifest instead of reporting unpublished", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-voice-discovery-"));
  const response = Promise.withResolvers<VoiceReleaseManifest>();
  vi.mocked(loadReleaseManifest).mockReturnValue(response.promise);
  const state: VoiceResourceOperationState = { phase: "idle" };
  const platform = voicePlatform()!;
  const component = {
    id: "engine",
    kind: "engine" as const,
    name: "Engine",
    version: "1",
    license: "MIT",
    files: [],
  };
  try {
    const first = resolveVoiceEngine(directory, state);
    await vi.waitFor(() => expect(loadReleaseManifest).toHaveBeenCalledOnce());
    const second = resolveVoiceEngine(directory, state);
    let returned = false;
    void second.then(() => {
      returned = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(returned).toBe(false);
    response.resolve({
      schemaVersion: 1,
      protocolVersion: 1,
      version: "1.0.0",
      engines: { [platform]: component },
      models: {},
    });
    const results = await Promise.all([first, second]);
    expect(results.map((result) => result?.component)).toEqual([component, component]);
    expect(loadReleaseManifest).toHaveBeenCalledOnce();
    expect(state.releaseLoading).toBeUndefined();
  } finally {
    response.resolve({
      schemaVersion: 1,
      protocolVersion: 1,
      version: "1.0.0",
      engines: {},
      models: {},
    });
    await rm(directory, { recursive: true, force: true });
  }
});
