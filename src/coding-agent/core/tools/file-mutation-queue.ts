import { realpath } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const pending = new Map<string, Promise<unknown>>();

async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    return join(await canonical(dirname(path)), basename(path));
  }
}

export async function withFileMutationQueue<T>(path: string, work: () => Promise<T>): Promise<T> {
  const key = await canonical(path);
  const previous = pending.get(key);
  const next = (previous ?? Promise.resolve()).catch(() => {}).then(work);

  pending.set(key, next);

  try {
    return await next;
  } finally {
    if (pending.get(key) === next) pending.delete(key);
  }
}
