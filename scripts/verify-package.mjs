import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { inspectDistributionFile, verifyDistribution } from "./distribution.ts";

const tarball = process.argv[2];
if (!tarball) throw new Error("Usage: pnpm verify:package <tarball>");
const archive = spawnSync("tar", ["-tzf", resolve(tarball)], { encoding: "utf8" });
assert.equal(archive.status, 0, archive.stderr);
const archiveFailures = archive.stdout
  .trim()
  .split(/\r?\n/)
  .filter((path) => !path.endsWith("/"))
  .flatMap((path) => inspectDistributionFile(path.replace(/^package\//, ""), ""));
assert.deepEqual(archiveFailures, [], "Tarball contains unexpected source or development files");
const base = await mkdtemp(resolve(".package-check-"));
const windows = process.platform === "win32";
const env = {
  ...process.env,
  HOME: base,
  ...(windows ? { USERPROFILE: base } : {}),
  LOOP_DATA_DIR: join(base, "data"),
};
// Restrict resolution to the installation so repository dependencies cannot mask omissions.
const guard = join(base, "isolate.mjs");
try {
  const app = join(base, "app");
  await mkdir(app);
  const installed = spawnSync(
    windows ? process.execPath : "npm",
    [
      // Run npm's JS entry directly; .cmd shims require a shell on Windows.
      ...(windows ? [join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")] : []),
      "install",
      "--prefix",
      app,
      "--omit=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      resolve(tarball),
    ],
    { env, encoding: "utf8" },
  );
  assert.equal(installed.status, 0, installed.stderr);
  await verifyDistribution(join(app, "node_modules/@loop-harness/loop"), true);
  await writeFile(
    guard,
    'import { registerHooks } from "node:module"; registerHooks({ resolve(specifier, context, next) { if (specifier === "bun" || specifier.startsWith("bun:") || specifier === "vite") throw Error("Development runtime requested"); const result = next(specifier, context); if (result.url.startsWith("file:") && !result.url.startsWith(' +
      JSON.stringify(pathToFileURL(base + "/").href) +
      ')) throw Error("Resolution escaped installed package"); return result; } });' +
      // Windows kill() forcibly terminates a process. IPC exercises the same close handler.
      'if (process.platform === "win32" && process.channel) process.once("message", (message) => { if (message !== "verify-shutdown") throw Error("Unexpected verifier message"); process.emit("SIGTERM"); process.disconnect(); });',
  );
  const entry = join(app, "node_modules/@loop-harness/loop/dist/bin.js");
  const inspect = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(guard).href,
      "--input-type=module",
      "-e",
      'import { createAgentSession } from "@loop-harness/loop"; if (typeof createAgentSession !== "function") throw Error("SDK missing");',
    ],
    { cwd: app, env, encoding: "utf8" },
  );
  assert.equal(inspect.status, 0, inspect.stderr);
  assert.equal(inspect.stdout, "");
  const help = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(guard).href, entry, "--help"],
    {
      cwd: base,
      env,
      encoding: "utf8",
    },
  );
  assert.equal(help.status, 0, help.stderr);
  assert.ok(help.stdout.includes("loop [-p]"));
  const child = spawn(
    process.execPath,
    ["--import", pathToFileURL(guard).href, entry, "web", "--port", "0", "--no-open"],
    {
      cwd: base,
      env,
      stdio: windows ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
    },
  );
  const exit = once(child, "close");
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
  try {
    let output = "";
    let url;
    for await (const chunk of child.stdout) {
      output += chunk;
      url = output.match(/Loop Web: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1];
      if (url) break;
    }
    assert.ok(url, errors);
    const html = await (await fetch(url)).text();
    assert.ok(html.includes("<title>Loop</title>"));
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    assert.ok(script);
    assert.equal((await fetch(new URL(script, url))).status, 200);
    assert.deepEqual(await (await fetch(new URL("api/workspaces", url))).json(), []);
    assert.deepEqual(await (await fetch(new URL("api/models", url))).json(), []);
    assert.deepEqual(
      (await (await fetch(new URL("api/settings/providers", url))).json()).providers,
      [],
    );
    assert.equal((await fetch(new URL("api/settings/provider", url))).status, 404);
    if (windows) child.send("verify-shutdown");
    else child.kill("SIGTERM");
    assert.equal((await exit)[0], 0, errors);
    console.log("Installed package: Node-only CLI, SDK, Web assets/API and clean shutdown passed.");
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) child.kill("SIGKILL");
    await exit;
  }
} finally {
  await rm(base, { recursive: true, force: true });
}
