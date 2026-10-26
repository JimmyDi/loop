import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { VoicePlatform } from "../resources/resource-types";
import { compileSidecar } from "./compile-sidecar";
import { writeEngineManifest } from "./engine-manifest";
import { runNativeBuildCommand } from "./native-build-command";
import { downloadNativeDependency } from "./native-download";
import { nativeReleases } from "./native-releases";

const native = dirname(fileURLToPath(import.meta.url));
const root = resolve(native, "../../../../../..");
const target = (process.platform + "-" + process.arch) as VoicePlatform;
const release = nativeReleases[target];
if (!release) throw new Error("Unsupported native build target");
const output = resolve(process.argv[2] ?? join(root, ".tools/voice/build", target));
const cache = join(root, ".tools/voice/dependencies");
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
const dependencyArg = process.argv[3];
let upstream: string;
if (dependencyArg) upstream = resolve(dependencyArg);
else {
  const archive = join(cache, release.asset);
  await downloadNativeDependency(
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.0/" + release.asset,
    archive,
    release.sha256,
  );
  await runNativeBuildCommand("tar", ["xjf", archive, "-C", cache], root);
  upstream = join(cache, release.asset.replace(/\.tar\.bz2$/, ""));
}
const include = join(cache, "include/nlohmann");
await mkdir(include, { recursive: true });
await downloadNativeDependency(
  "https://raw.githubusercontent.com/nlohmann/json/v3.12.0/single_include/nlohmann/json.hpp",
  join(include, "json.hpp"),
  "aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63",
);
const libraries = join(output, target.startsWith("win32") ? "" : "lib");
await mkdir(libraries, { recursive: true });
for (const entry of await readdir(join(upstream, "lib"))) {
  if (
    /sherpa-onnx-c-api.*\.(dylib|so(?:[.0-9]+)?|dll)$/.test(entry) ||
    /^libonnxruntime.*\.(dylib|so(?:[.0-9]+)?)$/.test(entry) ||
    entry === "onnxruntime.dll"
  ) {
    await cp(join(upstream, "lib", entry), join(libraries, entry), { dereference: true });
  }
}
const executable = target.startsWith("win32") ? "loop-voice.exe" : "loop-voice";
await compileSidecar({ root, native, cache, upstream, output, target, executable });
await runNativeBuildCommand(join(output, executable), ["--version"], root);
await cp(join(native, "THIRD_PARTY_LICENSES.md"), join(output, "THIRD_PARTY_LICENSES.md"));
await cp(join(native, "licenses"), join(output, "licenses"), { recursive: true });
if (dependencyArg)
  await cp(join(upstream, "licenses"), join(output, "licenses"), { recursive: true });
await cp(join(root, "LICENSE"), join(output, "licenses/loop.txt"));
await writeEngineManifest({ output, target, executable });
console.log("Native voice bundle prepared for " + target);
