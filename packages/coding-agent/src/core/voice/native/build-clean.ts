import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceCommand } from "./source-command";

if (process.platform !== "darwin" || process.arch !== "arm64")
  throw new Error("Clean native source build is currently validated for macOS ARM64 only");
const native = dirname(fileURLToPath(import.meta.url));
const root = resolve(native, "../../../../../..");
const output = resolve(process.argv[2] ?? join(root, ".tools/voice/build/darwin-arm64"));
const runtime = join(root, ".tools/voice/clean-ort/darwin-arm64");
const dependencies = join(root, ".tools/voice/clean-dependencies/darwin-arm64");
const run = async (file: string, args: string[]) => {
  await sourceCommand(process.execPath, ["--import", "tsx", join(native, file), ...args]);
};
await run("build-onnxruntime-source.ts", [runtime]);
await run("build-sherpa-source.ts", [runtime, dependencies]);
const { cp } = await import("node:fs/promises");
await cp(join(runtime, "lib"), join(dependencies, "lib"), { recursive: true });
await cp(join(runtime, "licenses"), join(dependencies, "licenses"), { recursive: true });
await run("build.ts", [output, dependencies]);
console.log(
  "Clean native source build completed. Package and verify the bundle before publication.",
);
