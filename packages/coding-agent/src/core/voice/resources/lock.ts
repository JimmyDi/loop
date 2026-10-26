import { lstatSync, mkdirSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const busy = (): Error => new Error("voice_resources_busy");

const removeDeadOwner = (directory: string): boolean => {
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw busy();
  const entries = readdirSync(directory);
  if (entries.length !== 1) throw busy();
  const name = entries[0]!;
  const match = /^owner-([1-9][0-9]*)-[a-f0-9-]{36}$/.exec(name);
  const pid = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(pid) || pid > 0x7fffffff) throw busy();
  try {
    process.kill(pid, 0);
    throw busy();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw busy();
  }
  try {
    unlinkSync(join(directory, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  try {
    rmdirSync(directory);
    return true;
  } catch (error) {
    if (["ENOENT", "ENOTEMPTY", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? ""))
      return false;
    throw error;
  }
};

export const acquireResourceLock = (root: string): (() => void) => {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (lstatSync(root).isSymbolicLink()) throw new Error("voice_resource_path_invalid");
  const directory = join(root, ".resource-lock");
  const owner = "owner-" + process.pid + "-" + crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (removeDeadOwner(directory)) continue;
      } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code !== "ENOENT") throw failure;
      }
      throw busy();
    }
    try {
      writeFileSync(join(directory, owner), "", { flag: "wx", mode: 0o600 });
    } catch (error) {
      rmdirSync(directory);
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      try {
        unlinkSync(join(directory, owner));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      rmdirSync(directory);
    };
  }
  throw busy();
};
