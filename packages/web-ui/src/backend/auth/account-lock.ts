import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";

/** One Web service owns a data root; stale locks require explicit local removal. */
export const acquireAccountLock = async (root: string): Promise<() => Promise<void>> => {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const file = join(root, "web-service.lock");
  try {
    const handle = await open(file, "wx", 0o600);
    try {
      await handle.writeFile(String(process.pid));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        "A Web service already owns this data directory; remove a stale web-service.lock only after confirming the service has stopped",
      );
    throw error;
  }
  return async () => {
    await unlink(file);
  };
};
