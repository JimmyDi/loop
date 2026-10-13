import { lstat, rename } from "node:fs/promises";

import { acquireTraceLock } from "./storage";

/** Move closed trace files into the caller's deletion transaction, retaining writer ownership. */
export const stageTraceDeletion = async (
  directory: string,
  destination: string,
): Promise<(() => Promise<void>) | undefined> => {
  try {
    if (!(await lstat(directory)).isDirectory()) throw new Error("Invalid trace directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  const release = await acquireTraceLock(directory, false);
  try {
    await rename(directory, destination);
  } catch (error) {
    await release();
    throw error;
  }
  return async () => {
    await rename(destination, directory);
    await release();
  };
};
