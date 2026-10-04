import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

import type { PermissionPolicy } from "./policy";
import { PermissionError } from "./permission-error";

/** Replace a regular file rather than mutating an inode shared through a hard link. */
export const writePermittedFile = async (
  policy: PermissionPolicy,
  path: string,
  content: string,
  signal: AbortSignal,
): Promise<void> => {
  signal.throwIfAborted();
  const target = await policy.checkWrite(path);
  let mode = 0o600;
  try {
    const info = await lstat(target);
    if (!info.isFile()) throw new PermissionError("Target is not a regular file");
    mode = info.mode & 0o777;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  signal.throwIfAborted();
  await mkdir(dirname(target), { recursive: true });
  const temporary = target + "." + crypto.randomUUID() + ".tmp";
  if ((await policy.checkWrite(temporary)) !== temporary)
    throw new PermissionError("Target directory changed");
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.chmod(mode);
    await file.close();
    signal.throwIfAborted();
    if (
      (await policy.checkWrite(path)) !== target ||
      (await policy.checkWrite(temporary)) !== temporary
    ) {
      throw new PermissionError("Target changed before the write");
    }
    await rename(temporary, target);
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
};
