import { readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readReviewedMetadata, reviewedReleaseComponent } from "./release-assets";
import type { VoiceComponent } from "../resources/resource-types";
import {
  selectedMetadataFiles,
  selectReleaseCatalog,
  selectReleaseTargets,
} from "./release-targets";

const [directoryArg, tag, ...targetArgs] = process.argv.slice(2);
if (!directoryArg || !tag || !/^voice-v[0-9]+[.][0-9]+[.][0-9]+$/.test(tag))
  throw new Error(
    "Usage: prepare-catalog.ts <asset-directory> <voice-vX.Y.Z> [--targets <comma-separated-platforms>]",
  );
const targets = selectReleaseTargets(targetArgs);
const directory = resolve(directoryArg);
const components: VoiceComponent[] = [];
for (const name of selectedMetadataFiles(await readdir(directory), targets)) {
  for (const item of await readReviewedMetadata(join(directory, name)))
    components.push(await reviewedReleaseComponent(directory, tag, item));
}
const { engines, models } = selectReleaseCatalog(components, targets);
const source =
  'import type { VoiceComponent, VoicePlatform } from "./resource-types";\n\n' +
  "export const publishedVoiceEngines: Partial<Record<VoicePlatform, VoiceComponent>> = " +
  JSON.stringify(engines, null, 2) +
  ";\n\n" +
  "export const publishedVoiceModels: Partial<Record<string, VoiceComponent>> = " +
  JSON.stringify(models, null, 2) +
  ";\n";
await writeFile(join(directory, "published-catalog.ts"), source);
console.log(
  "Prepared reviewed catalog candidate for " +
    targets.join(", ") +
    ". Upload verified assets before adopting this file.",
);
