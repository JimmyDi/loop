import { homedir } from "node:os";
import { resolve } from "node:path";

export function resolveToCwd(path: string, cwd: string): string {
  return resolve(cwd, path.startsWith("~/") ? homedir() + path.slice(1) : path);
}
