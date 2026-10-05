import { dirname } from "node:path";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";

export async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const temporary = path + "." + crypto.randomUUID() + ".tmp";

  try {
    await writeFile(temporary, contents, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
