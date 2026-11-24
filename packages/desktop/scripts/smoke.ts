import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { strict as assert } from "node:assert";

const desktop = resolve(import.meta.dirname, "..");
const output = join(desktop, "dist");
const data = await mkdtemp(join(desktop, ".tools/smoke-"));
const node = join(output, "runtime", process.platform === "win32" ? "node.exe" : "node");
const env = {
  ...process.env,
  NODE_PATH: "",
  NODE_OPTIONS: "",
  LOOP_DATA_DIR: data,
  LOOP_DESKTOP_STATE_DIR: join(data, "desktop"),
  LOOP_DESKTOP_TOKEN: "synthetic-smoke-token",
};
// Detect dependency resolution escaping the packaged application.
const guard = join(data, "isolation.mjs");
await writeFile(
  guard,
  'import { registerHooks } from "node:module"; registerHooks({ resolve(specifier, context, next) { const result = next(specifier, context); if (result.url.startsWith("file:") && !result.url.startsWith(' +
    JSON.stringify(pathToFileURL(output + "/").href) +
    ')) throw Error("Resolution escaped desktop distribution"); return result; } });',
);
const args = ["--import", pathToFileURL(guard).href];
await mkdir(join(data, "web-ui"));
await writeFile(
  join(data, "web-ui/provider.json"),
  JSON.stringify({
    version: 2,
    providers: [
      {
        id: "example",
        kind: "custom",
        name: "Existing Web provider",
        api: "openai-completions",
        baseUrl: "https://example.test/v1",
        authentication: "none",
        models: [{ id: "example-model" }],
      },
    ],
  }),
);
const child = spawn(node, [...args, join(output, "backend.js")], {
  cwd: data,
  env,
  stdio: ["pipe", "pipe", "pipe"],
});
const exit = once(child, "exit");
let diagnostic = "";
child.stderr.on("data", (data) => {
  diagnostic += data;
});
const timer = setTimeout(() => child.kill(), 30_000);
const lines = createInterface({ input: child.stdout });
const messages = lines[Symbol.asyncIterator]();
const next = async () => {
  const value = await messages.next();
  assert.ok(!value.done, diagnostic);
  return JSON.parse(value.value);
};
try {
  const ready = await next();
  assert.equal(ready.event, "ready", diagnostic);
  const response = await fetch(ready.url + "/__desktop/bootstrap?token=synthetic-smoke-token", {
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const headers = { cookie };
  const providers = await (await fetch(ready.url + "/api/settings/providers", { headers })).json();
  assert.equal(providers.providers[0].id, "example");
  assert.equal(providers.providers[0].models[0].id, "example-model");
  const page = await fetch(ready.url, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /__desktop\/client.js/);
  assert.deepEqual(await (await fetch(ready.url + "/api/workspaces", { headers })).json(), []);
  child.stdin.write(JSON.stringify({ id: 1, action: "prepare", stop: false }) + "\n");
  assert.deepEqual(await next(), { id: 1, ok: true, value: true });
  assert.equal((await fetch(ready.url + "/api/workspaces", { headers })).status, 503);
  child.stdin.write(JSON.stringify({ id: 2, action: "shutdown" }) + "\n");
  assert.equal((await next()).ok, true);
  child.stdin.end();
  assert.equal((await exit)[0], 0, diagnostic);
  const code =
    'import { CodemodeSandbox } from "@earendil-works/pi-codemode"; const sandbox = new CodemodeSandbox(); try { const result = await sandbox.execute("return 1 + 1"); if (!result.ok || result.value !== 2) throw Error(JSON.stringify(result)); } finally { await sandbox.close(); }';
  const sample = join(output, "smoke-codemode.mjs");
  await writeFile(sample, code);
  try {
    execFileSync(node, [...args, sample], { cwd: output, env, stdio: "pipe" });
  } finally {
    await rm(sample, { force: true });
  }
  const version = JSON.parse(await readFile(join(output, "package.json"), "utf8")).version;
  assert.equal(
    version,
    JSON.parse(await readFile(join(desktop, "../../package.json"), "utf8")).version,
  );
  console.log("Desktop packaged Node, Web, API, Codemode/WASM, maintenance and shutdown passed");
} finally {
  clearTimeout(timer);
  child.kill();
  lines.close();
  await rm(data, { recursive: true, force: true });
}
