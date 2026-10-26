import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { getAgentDir } from "../../../config";
import { VoiceResourceManager } from "../voice-resource-manager";
import { validateEngineManifest } from "../resources/engine-manifest";

const [engineArg, modelsArg] = process.argv.slice(2);
if (!engineArg) throw new Error("Usage: import-local.ts <engine-directory> [models-directory]");
const engine = resolve(engineArg);
const manager = new VoiceResourceManager(getAgentDir());
const manifest = validateEngineManifest(
  JSON.parse(await readFile(join(engine, "engine-manifest.json"), "utf8")),
);
await manager.importLocalEngine(engine, manifest);
if (modelsArg) await manager.importLocalModels(resolve(modelsArg));
await manager.install({
  tts: (await manager.status()).components.some((item) => item.kind === "tts" && item.installed),
});
console.log("Local voice resources verified and activated.");
