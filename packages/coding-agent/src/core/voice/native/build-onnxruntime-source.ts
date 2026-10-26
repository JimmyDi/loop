import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadOnnxruntimeSource } from "./onnxruntime-source";
import type { SourceLock } from "./source-lock-types";
import { verifiedSourceArchive } from "./source-archives";
import { patchSource } from "./source-patch";
import { sourceCommand } from "./source-command";
import type { SourceDependency } from "./source-dependency-types";
import { assertReleaseFilesClean } from "./release-scan";

const outputArg = process.argv[2];
if (process.platform !== "darwin" || process.arch !== "arm64" || !outputArg)
  throw new Error("Usage on macOS ARM64: build-onnxruntime-source.ts <output-directory>");
const native = dirname(fileURLToPath(import.meta.url));
const root = resolve(native, "../../../../../.."),
  work = join(root, ".tools/voice/onnxruntime-source");
const output = resolve(outputArg),
  source = join(work, "working-source"),
  build = join(work, "build"),
  mirror = join(work, "mirror");
const lock = JSON.parse(
  await readFile(join(native, "onnxruntime-source-lock.json"), "utf8"),
) as SourceLock;
await downloadOnnxruntimeSource(join(work, "source"), lock);
await cp(join(work, "source"), source, { recursive: true });
await patchSource(
  join(source, "cmake/onnxruntime.cmake"),
  "    VERSION ${ORT_VERSION}\n    SOVERSION 1\n",
  "",
);
const dependencies = JSON.parse(
  await readFile(join(native, "onnxruntime-dependencies.json"), "utf8"),
) as SourceDependency[];
for (const dependency of dependencies) {
  const url = new URL(dependency.url);
  const path = join(mirror, url.host, url.pathname);
  await verifiedSourceArchive(
    dirname(path),
    url.pathname.split("/").at(-1)!,
    dependency.url,
    dependency.sha256,
  );
}
const cmake = process.env.LOOP_VOICE_CMAKE ?? "cmake";
const flags = ["file", "macro", "debug"]
  .map((kind) => "-f" + kind + "-prefix-map=" + join(root, ".tools/voice") + "=upstream")
  .join(" ");
const args = [
  "-S",
  join(source, "cmake"),
  "-B",
  build,
  "-DCMAKE_BUILD_TYPE=Release",
  "-DCMAKE_C_FLAGS=" + flags,
  "-DCMAKE_CXX_FLAGS=" + flags,
  "-DCMAKE_DISABLE_FIND_PACKAGE_Git=ON",
  "-DGit_FOUND=FALSE",
  "-DGIT_FOUND=FALSE",
  "-DGIT_EXECUTABLE=GIT_EXECUTABLE-NOTFOUND",
  "-DFETCHCONTENT_UPDATES_DISCONNECTED=ON",
  "-Donnxruntime_CMAKE_DEPS_MIRROR_DIR=" + mirror,
  "-Donnxruntime_BUILD_SHARED_LIB=ON",
  "-DCMAKE_BUILD_WITH_INSTALL_RPATH=ON",
  "-DCMAKE_INSTALL_RPATH=@loader_path",
  "-DCMAKE_INSTALL_RPATH_USE_LINK_PATH=OFF",
];
for (const option of [
  "onnxruntime_BUILD_UNIT_TESTS",
  "onnxruntime_BUILD_BENCHMARKS",
  "onnxruntime_ENABLE_PYTHON",
  "ONNX_BUILD_PYTHON",
  "ONNX_BUILD_TESTS",
  "JSON_CI",
  "JSON_BuildTests",
  "BUILD_TESTING",
  "GSL_TEST",
  "FLATBUFFERS_BUILD_BENCHMARKS",
  "CPUINFO_BUILD_UNIT_TESTS",
  "CPUINFO_BUILD_MOCK_TESTS",
  "CPUINFO_BUILD_BENCHMARKS",
])
  args.push("-D" + option + "=OFF");
for (const option of ["COREML", "XNNPACK", "WEBGPU", "KLEIDIAI", "CUDA", "TENSORRT", "VCPKG"])
  args.push("-Donnxruntime_USE_" + option + "=OFF");
for (const option of ["TRAINING", "TRAINING_APIS", "TRAINING_OPS"])
  args.push("-Donnxruntime_ENABLE_" + option + "=OFF");
if (process.env.LOOP_VOICE_NINJA)
  args.push("-G", "Ninja", "-DCMAKE_MAKE_PROGRAM=" + resolve(process.env.LOOP_VOICE_NINJA));
await sourceCommand(cmake, args);
await sourceCommand(cmake, ["--build", build, "--target", "onnxruntime", "--parallel", "8"]);
await mkdir(join(output, "lib"), { recursive: true });
for (const name of ["libonnxruntime.dylib"])
  await cp(join(build, name), join(output, "lib", name), { dereference: true });
await cp(join(source, "include/onnxruntime/core/session"), join(output, "include"), {
  recursive: true,
});
await mkdir(join(output, "licenses"), { recursive: true });
await cp(join(source, "LICENSE"), join(output, "licenses/onnxruntime.txt"));
await cp(
  join(source, "ThirdPartyNotices.txt"),
  join(output, "licenses/onnxruntime-third-party.txt"),
);
let notices = "";
for (const name of await readdir(join(build, "_deps"))) {
  if (!name.endsWith("-src")) continue;
  const directory = join(build, "_deps", name);
  for (const entry of await readdir(directory, { withFileTypes: true }))
    if (entry.isFile() && /^(LICENSE|COPYING|NOTICE|AUTHORS)([.]|$)/i.test(entry.name))
      notices +=
        "\n===== " +
        name +
        "/" +
        entry.name +
        " =====\n" +
        (await readFile(join(directory, entry.name), "utf8")) +
        "\n";
}
await writeFile(join(output, "licenses/onnxruntime-linked-dependencies.txt"), notices);
const files = [
  { path: "lib/libonnxruntime.dylib" },
  ...(await readdir(join(output, "licenses"))).map((path) => ({ path: "licenses/" + path })),
];
await assertReleaseFilesClean(output, { files });
console.log("Source-built CPU ONNX Runtime and retained notices prepared and scanned.");
