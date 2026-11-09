import { randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export const readPrivateJson = async (file: string): Promise<unknown> => {
  try {
    if (process.platform !== "win32") await chmod(file, 0o600);
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("Invalid account storage");
  }
};

export const writePrivateJson = async (file: string, value: unknown): Promise<void> => {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") await chmod(dirname(file), 0o700);
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(value) + "\n");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
};
