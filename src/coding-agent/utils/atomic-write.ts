import { mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

export async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const temporary = path + "." + crypto.randomUUID() + ".tmp";

  try {
    await Bun.write(temporary, contents, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
