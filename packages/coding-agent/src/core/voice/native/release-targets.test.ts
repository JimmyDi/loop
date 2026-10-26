import { expect, test } from "vitest";
import { sourceVoiceModels } from "../resources/catalog";
import type { VoiceComponent, VoicePlatform } from "../resources/resource-types";
import { releaseVoicePlatforms } from "./release-assets";
import {
  selectedMetadataFiles,
  selectReleaseCatalog,
  selectReleaseTargets,
} from "./release-targets";

const engine = (target: VoicePlatform): VoiceComponent => ({
  id: "loop-voice-" + target,
  kind: "engine",
  name: "Synthetic engine",
  version: "1.0.0",
  license: "MIT",
  files: [],
});

test("catalog defaults to Apple Silicon and accepts only an explicit unique platform set", () => {
  expect(selectReleaseTargets([])).toEqual(["darwin-arm64"]);
  expect(selectReleaseTargets(["--targets", "linux-x64,darwin-arm64"])).toEqual([
    "linux-x64",
    "darwin-arm64",
  ]);
  expect(selectReleaseTargets(["--targets", releaseVoicePlatforms.join(",")])).toEqual(
    releaseVoicePlatforms,
  );
});

test.each([
  ["--targets"],
  ["--targets", ""],
  ["--targets", "darwin-arm64,"],
  ["--targets", "darwin-arm64,unknown"],
  ["--targets", "darwin-arm64,darwin-arm64"],
  ["--targets", "linux-x64", "extra"],
  ["--platforms", "linux-x64"],
])("rejects malformed or ambiguous platform arguments %j", (...args) => {
  expect(() => selectReleaseTargets(args)).toThrow();
});

test("selected metadata excludes unrequested engines while always including all model metadata", () => {
  expect(
    selectedMetadataFiles(
      [
        "reviewed-engine-linux-x64.json",
        "reviewed-engine-darwin-arm64.json",
        "reviewed-model-assets.json",
        "published-catalog.ts",
        "reviewed-engine-unknown.json",
      ],
      ["darwin-arm64"],
    ),
  ).toEqual(["reviewed-engine-darwin-arm64.json", "reviewed-model-assets.json"]);
});

test("Apple Silicon catalog requires only its engine and all three models and omits other engines", () => {
  const selected = engine("darwin-arm64");
  const { engines, models } = selectReleaseCatalog(
    [selected, engine("linux-x64"), ...sourceVoiceModels],
    selectReleaseTargets([]),
  );
  expect(engines).toEqual({ "darwin-arm64": selected });
  expect(Object.keys(models)).toEqual(sourceVoiceModels.map((model) => model.id));
});

test("a requested platform cannot be satisfied by an unselected engine", () => {
  expect(() =>
    selectReleaseCatalog([engine("linux-x64"), ...sourceVoiceModels], ["darwin-arm64"]),
  ).toThrow("Missing required voice release components: darwin-arm64");
  expect(() =>
    selectReleaseCatalog(
      [engine("darwin-arm64"), ...sourceVoiceModels],
      ["darwin-arm64", "linux-x64"],
    ),
  ).toThrow("linux-x64");
});

test.each(sourceVoiceModels.map((model) => model.id))(
  "every release requires pinned model %s",
  (id) => {
    expect(() =>
      selectReleaseCatalog(
        [engine("darwin-arm64"), ...sourceVoiceModels.filter((model) => model.id !== id)],
        ["darwin-arm64"],
      ),
    ).toThrow("Missing required voice release components: " + id);
  },
);

test("duplicate selected components and unexpected models are rejected", () => {
  const selected = engine("darwin-arm64");
  expect(() =>
    selectReleaseCatalog([selected, selected, ...sourceVoiceModels], ["darwin-arm64"]),
  ).toThrow("Duplicate voice release component");
  expect(() =>
    selectReleaseCatalog([selected, ...sourceVoiceModels, sourceVoiceModels[0]!], ["darwin-arm64"]),
  ).toThrow("Duplicate voice release component");
  expect(() =>
    selectReleaseCatalog(
      [
        selected,
        ...sourceVoiceModels,
        {
          ...sourceVoiceModels[0]!,
          id: "unexpected-model",
        },
      ],
      ["darwin-arm64"],
    ),
  ).toThrow("Unknown voice release model");
});
