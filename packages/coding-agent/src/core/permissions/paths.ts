import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { lstat, readlink, realpath } from "node:fs/promises";

export const isWithin = (path: string, root: string): boolean => {
  const suffix = relative(root, path);
  return (
    suffix === "" || (!isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith(".." + sep))
  );
};

/** Resolve missing leaves and dangling links without treating a link as a new directory. */
export const canonicalPath = async (path: string, links = 0): Promise<string> => {
  if (!isAbsolute(path) || path.includes("\0")) throw new Error("Expected an absolute file path");
  if (links > 40) throw new Error("Too many symbolic links");
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    if ((await lstat(path)).isSymbolicLink()) {
      return canonicalPath(resolve(dirname(path), await readlink(path)), links + 1);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const parent = dirname(path);
  if (parent === path) throw new Error("Filesystem root is unavailable");
  return join(await canonicalPath(parent, links), basename(path));
};

/** A missing protected directory requires a read-only mount of its nearest existing ancestor. */
export const existingAncestor = async (path: string): Promise<string> => {
  try {
    await lstat(path);
    return path;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    if (parent === path) throw error;
    return existingAncestor(parent);
  }
};
