import { cp, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const target = process.env.DESKTOP_TARGET;
if (!target || !["darwin-aarch64", "darwin-x86_64", "windows-x86_64"].includes(target))
  throw new Error("Invalid desktop target");
const desktop = resolve(import.meta.dirname, "..");
const output = join(desktop, ".tools/artifacts", target);
await mkdir(output, { recursive: true });
const collect = async (directory: string): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !entry.name.endsWith(".app")) await collect(path);
    else if (entry.isFile() && /\.(dmg|exe|tar\.gz|sig)$/.test(entry.name))
      await cp(path, join(output, entry.name));
  }
};
await collect(join(desktop, "src-tauri/target/release/bundle"));
if (!(await readdir(output)).length) throw new Error("No desktop installers produced");
