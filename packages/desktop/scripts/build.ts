import { cp, mkdir, readFile, rm, writeFile, chmod, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { build as bundle } from "tsdown";
import { build as vite } from "vite";

const root = resolve(import.meta.dirname, "../../..");
const desktop = join(root, "packages/desktop");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageFile = join(desktop, "package.json");
const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
if (packageJson.version !== manifest.version) {
  packageJson.version = manifest.version;
  await writeFile(packageFile, JSON.stringify(packageJson, null, 2) + "\n");
}
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run desktop builds with pnpm");
const run = (args: string[], cwd = root) =>
  execFileSync(process.execPath, [pnpm, ...args], { cwd, stdio: "inherit" });
run(["--filter", "@loop/coding-agent...", "build"]);
run(["--filter", "@loop/web-ui", "exec", "tsdown"]);
const output = join(desktop, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await bundle({
  config: false,
  entry: [join(desktop, "src/backend.ts")],
  outDir: output,
  clean: true,
  platform: "node",
  target: "node24",
  format: "esm",
  fixedExtension: false,
  deps: {
    alwaysBundle: [/^@loop\//],
    neverBundle: [...Object.keys(manifest.dependencies), "vite"],
  },
  sourcemap: false,
});
await vite({
  configFile: join(root, "packages/web-ui/vite.config.ts"),
  configLoader: "runner",
  plugins: [
    {
      name: "desktop-entry",
      transform(code, id) {
        if (id.endsWith("/frontend/main.tsx")) return code.replace("startPwa();", "");
      },
    },
  ],
  build: { outDir: join(output, "web"), emptyOutDir: true },
});
const page = join(output, "web/index.html");
let html = await readFile(page, "utf8");
html = html.replace(/<link[^>]+rel="manifest"[^>]*>/g, "");
html = html.replace("</head>", '<link rel="stylesheet" href="/__desktop/client.css"></head>');
html = html.replace("</body>", '<script type="module" src="/__desktop/client.js"></script></body>');
await writeFile(page, html);
await vite({
  configFile: false,
  build: {
    outDir: join(output, "web"),
    emptyOutDir: false,
    lib: {
      entry: join(desktop, "src/client.ts"),
      formats: ["es"],
      fileName: () => "client.js",
      cssFileName: "client",
    },
  },
});
// Materialize a self-contained dependency graph using the workspace lockfile resolutions.
const installed = new Map<string, string>();
const copyDependency = async (
  name: string,
  from: string,
  destination: string,
  ancestors = new Map<string, string>(),
): Promise<void> => {
  let directory = from;
  let source: string;
  while (true) {
    try {
      source = await realpath(join(directory, "node_modules", name));
      break;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) throw new Error("Missing dependency " + name);
      directory = parent;
    }
  }
  const info = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  if (ancestors.get(name) === info.version) return;
  const nextAncestors = new Map(ancestors).set(name, info.version);
  const rootTarget = join(output, "node_modules", name);
  const target =
    installed.has(rootTarget) && installed.get(rootTarget) !== info.version
      ? join(destination, "node_modules", name)
      : rootTarget;
  if (installed.get(target) === info.version) return;
  installed.set(target, info.version);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    filter: (path) => !path.startsWith(join(source, "node_modules")),
  });
  for (const dependency of Object.keys(info.dependencies ?? {}))
    await copyDependency(dependency, source, target, nextAncestors);
  for (const dependency of Object.keys(info.optionalDependencies ?? {})) {
    try {
      await copyDependency(dependency, source, target, nextAncestors);
    } catch {
      /* Optional platform packages may be absent. */
    }
  }
};
await writeFile(
  join(output, "package.json"),
  JSON.stringify({ type: "module", version: manifest.version }),
);
for (const name of Object.keys(manifest.dependencies)) await copyDependency(name, root, output);
await cp(join(root, "LICENSE"), join(output, "LICENSE"));
const licenseFile = join(dirname(process.execPath), "../LICENSE");
try {
  await cp(licenseFile, join(output, "NODE-LICENSE"));
} catch {
  execFileSync(
    "curl",
    [
      "--fail",
      "--location",
      "--retry",
      "3",
      "--max-time",
      "60",
      "https://raw.githubusercontent.com/nodejs/node/v" + process.versions.node + "/LICENSE",
      "--output",
      join(output, "NODE-LICENSE"),
    ],
    { stdio: "inherit" },
  );
}
const cargo = join(desktop, "src-tauri/Cargo.toml");
const cargoSource = await readFile(cargo, "utf8");
const updatedCargo = cargoSource.replace(
  /^version = ".*"$/m,
  'version = "' + manifest.version + '"',
);
if (updatedCargo !== cargoSource) await writeFile(cargo, updatedCargo);
const runtime = join(output, "runtime");
const lockfile = join(desktop, "src-tauri/Cargo.lock");
const lockSource = await readFile(lockfile, "utf8");
const updatedLock = lockSource.replace(
  /(\[\[package\]\]\nname = "loop-desktop"\nversion = )"[^"]+"/,
  '$1"' + manifest.version + '"',
);
if (updatedLock !== lockSource) await writeFile(lockfile, updatedLock);
await mkdir(runtime);
await cp(process.execPath, join(runtime, process.platform === "win32" ? "node.exe" : "node"));
if (process.platform !== "win32") await chmod(join(runtime, "node"), 0o755);
const config = {
  version: manifest.version,
  ...(process.env.LOOP_UPDATER_URL && process.env.LOOP_UPDATER_PUBLIC_KEY
    ? {
        bundle: { createUpdaterArtifacts: true },
        plugins: {
          updater: {
            endpoints: [process.env.LOOP_UPDATER_URL],
            pubkey: process.env.LOOP_UPDATER_PUBLIC_KEY,
            windows: { installMode: "passive" },
          },
        },
      }
    : {}),
};
if (!!process.env.LOOP_UPDATER_URL !== !!process.env.LOOP_UPDATER_PUBLIC_KEY)
  throw new Error("Configure both updater URL and verification key");
if (process.env.LOOP_UPDATER_URL && !process.env.LOOP_UPDATER_URL.startsWith("https://"))
  throw new Error("The updater requires HTTPS");
await mkdir(join(desktop, ".tools"), { recursive: true });
await writeFile(join(desktop, ".tools/tauri-build.json"), JSON.stringify(config, null, 2));
run(
  ["exec", "tauri", "icon", join(desktop, "assets/icon.png"), "--output", "src-tauri/icons"],
  desktop,
);
console.log("Desktop resources built for " + process.platform + "-" + process.arch);
