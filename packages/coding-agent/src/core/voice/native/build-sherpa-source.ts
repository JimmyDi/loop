import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sherpaSource, sherpaSourceDependencies } from "./source-dependencies";
import { unpackSourceArchive, verifiedSourceArchive } from "./source-archives";
import { patchSource } from "./source-patch";
import { sourceCommand } from "./source-command";

const [runtimeArg, outputArg] = process.argv.slice(2);
if (process.platform !== "darwin" || process.arch !== "arm64" || !runtimeArg || !outputArg)
  throw new Error(
    "Usage on macOS ARM64: build-sherpa-source.ts <onnxruntime-directory> <output-directory>",
  );
const native = dirname(fileURLToPath(import.meta.url));
const root = resolve(native, "../../../../../..");
const work = join(root, ".tools/voice/sherpa-source");
const runtime = resolve(runtimeArg),
  output = resolve(outputArg);
const cmake = process.env.LOOP_VOICE_CMAKE ?? "cmake";
const flags =
  ["file", "macro", "debug"]
    .map((kind) => "-f" + kind + "-prefix-map=" + join(root, ".tools/voice") + "=upstream")
    .join(" ") + " -DSHERPA_ONNX_DISABLE_COREML";
const sourceArchive = await verifiedSourceArchive(
  join(work, "archives"),
  "sherpa.tar.gz",
  "https://codeload.github.com/k2-fsa/sherpa-onnx/tar.gz/" + sherpaSource.revision,
  sherpaSource.sha256,
);
const source = await unpackSourceArchive(sourceArchive, join(work, "source"));
await patchSource(
  join(source, "CMakeLists.txt"),
  "set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)",
  "set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)",
);
const args = [
  "-S",
  source,
  "-B",
  join(work, "build"),
  "-DCMAKE_BUILD_TYPE=Release",
  "-DCMAKE_C_FLAGS=" + flags,
  "-DCMAKE_CXX_FLAGS=" + flags,
  "-DCMAKE_DISABLE_FIND_PACKAGE_Git=ON",
  "-DGit_FOUND=FALSE",
  "-DGIT_FOUND=FALSE",
  "-DGIT_EXECUTABLE=GIT_EXECUTABLE-NOTFOUND",
  "-DFETCHCONTENT_UPDATES_DISCONNECTED=ON",
  "-DFETCHCONTENT_FULLY_DISCONNECTED=ON",
  "-DBUILD_SHARED_LIBS=ON",
  "-DBUILD_TESTING=OFF",
  "-DJSON_CI=OFF",
  "-DJSON_BuildTests=OFF",
  "-DCMAKE_BUILD_WITH_INSTALL_RPATH=ON",
];
for (const option of ["BINARY", "PORTAUDIO", "WEBSOCKET", "PYTHON", "TESTS", "SPEAKER_DIARIZATION"])
  args.push("-DSHERPA_ONNX_ENABLE_" + option + "=OFF");
for (const option of ["C_API", "TTS"]) args.push("-DSHERPA_ONNX_ENABLE_" + option + "=ON");
await mkdir(join(output, "licenses"), { recursive: true });
for (const dependency of sherpaSourceDependencies) {
  const extension = dependency.url.endsWith(".zip") ? ".zip" : ".tar.gz";
  const archive = await verifiedSourceArchive(
    join(work, "archives"),
    dependency.name + extension,
    dependency.url,
    dependency.sha256,
  );
  const directory = await unpackSourceArchive(archive, join(work, "dependencies", dependency.name));
  args.push(
    "-DFETCHCONTENT_SOURCE_DIR_" +
      dependency.name
        .replaceAll("-", dependency.name === "simple-sentencepiece" ? "-" : "_")
        .toUpperCase() +
      "=" +
      directory,
  );
  for (const license of dependency.licenses)
    await cp(
      join(directory, license),
      join(output, "licenses", dependency.name + "-" + license.replaceAll(".", "_") + ".txt"),
    );
}
if (process.env.LOOP_VOICE_NINJA)
  args.push("-G", "Ninja", "-DCMAKE_MAKE_PROGRAM=" + resolve(process.env.LOOP_VOICE_NINJA));
const env = {
  ...process.env,
  SHERPA_ONNXRUNTIME_INCLUDE_DIR: join(runtime, "include"),
  SHERPA_ONNXRUNTIME_LIB_DIR: join(runtime, "lib"),
};
await sourceCommand(cmake, args, { env });
await sourceCommand(
  cmake,
  ["--build", join(work, "build"), "--target", "sherpa-onnx-c-api", "--parallel", "8"],
  { env },
);
await cp(join(source, "sherpa-onnx/c-api"), join(output, "include/sherpa-onnx/c-api"), {
  recursive: true,
});
await mkdir(join(output, "lib"), { recursive: true });
await cp(
  join(work, "build/lib/libsherpa-onnx-c-api.dylib"),
  join(output, "lib/libsherpa-onnx-c-api.dylib"),
);
await cp(join(source, "LICENSE"), join(output, "licenses/sherpa-onnx.txt"));
console.log(
  "Source-built sherpa C API prepared. Pair with a validated ONNX Runtime before packaging.",
);
