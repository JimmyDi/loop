import { dirname } from "node:path";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";

import type { PermissionPolicy } from "./policy";
import { PermissionError } from "./permission-error";
import type { FileWritePermit } from "./file-approval";
import { canonicalPath } from "./paths";

/** Replace a regular file rather than mutating an inode shared through a hard link. */
export const writePermittedFile = async (
  policy: PermissionPolicy,
  path: string,
  content: string,
  signal: AbortSignal,
  permit?: FileWritePermit,
): Promise<void> => {
  signal.throwIfAborted();
  await permit?.consume(path, content);
  const target = permit?.target ?? (await policy.checkWrite(path));
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
  if ((await (permit ? canonicalPath(temporary) : policy.checkWrite(temporary))) !== temporary)
    throw new PermissionError("Target directory changed");
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.chmod(mode);
    await file.close();
    signal.throwIfAborted();
    await permit?.check();
    if (
      (await (permit ? canonicalPath(path) : policy.checkWrite(path))) !== target ||
      (await (permit ? canonicalPath(temporary) : policy.checkWrite(temporary))) !== temporary
    ) {
      throw new PermissionError("Target changed before the write");
    }
    signal.throwIfAborted();
    await rename(temporary, target);
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
};
