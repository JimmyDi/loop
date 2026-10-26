import { join } from "node:path";
import { runNativeBuildCommand } from "./native-build-command";
import type { NativeSidecarBuildOptions } from "./native-build-types";

export const compileSidecar = async (options: NativeSidecarBuildOptions): Promise<void> => {
  const { root, native, cache, upstream, output, target, executable } = options;
  if (target.startsWith("win32")) {
    await runNativeBuildCommand(
      "cl",
      [
        "/nologo",
        "/std:c++17",
        "/EHsc",
        "/O2",
        "/MT",
        "/pathmap:" + root + "=loop",
        "/I" + join(upstream, "include"),
        "/I" + join(cache, "include"),
        join(native, "sidecar.cpp"),
        "/Fo" + join(cache, "loop-voice-" + target + ".obj"),
        "/Fe:" + join(output, executable),
        "/link",
        "/LIBPATH:" + join(upstream, "lib"),
        "sherpa-onnx-c-api.lib",
      ],
      output,
    );
  } else {
    await runNativeBuildCommand(
      process.env.CXX ?? "c++",
      [
        "-std=c++17",
        "-O2",
        "-pthread",
        ...["file", "macro", "debug"].map((kind) => "-f" + kind + "-prefix-map=" + root + "=loop"),
        "-I",
        join(upstream, "include"),
        "-I",
        join(cache, "include"),
        join(native, "sidecar.cpp"),
        "-L",
        join(upstream, "lib"),
        "-lsherpa-onnx-c-api",
        target.startsWith("darwin") ? "-Wl,-rpath,@executable_path/lib" : "-Wl,-rpath,$ORIGIN/lib",
        "-o",
        join(output, executable),
      ],
      root,
    );
  }
};
