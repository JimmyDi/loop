import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { strict as assert } from "node:assert";

const root = resolve(import.meta.dirname, "../../..");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
assert.ok(!Object.keys(manifest.dependencies).some((name) => /tauri|electron|desktop/.test(name)));
let bytes = 0;
const inspect = async (directory: string): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    assert.ok(
      !/desktop|tauri|\.exe$|\.dmg$|\.wasm$/.test(entry.name),
      "Desktop asset leaked into npm distribution",
    );
    if (entry.isDirectory()) await inspect(file);
    else {
      bytes += (await stat(file)).size;
      if (entry.name.endsWith(".js")) {
        const source = await readFile(file, "utf8");
        assert.ok(
          !source.includes("/__desktop/") && !source.includes("tauri-plugin-updater"),
          "Desktop implementation leaked into npm bundle",
        );
      }
    }
  }
};
await inspect(join(root, "dist"));
console.log("npm compiled distribution bytes: " + bytes + "; desktop assets and dependencies: 0");
