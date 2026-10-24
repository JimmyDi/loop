import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const filesIn = async (directory: string, prefix = ""): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...(await filesIn(directory, path)));
    else if (entry.isFile()) files.push(path);
    else throw new Error("Frontend output must contain only regular files");
  }
  return files;
};

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export const publishFrontend = async (staging: string, target: string): Promise<void> => {
  const files = await filesIn(staging);
  for (const name of ["index.html", "remote.html", "sw.js"])
    if (!files.includes(name)) throw new Error("Frontend output is incomplete");
  // Validate immutable names before publishing any entry or replacing stable assets.
  for (const name of files.filter((name) => name.startsWith("assets/"))) {
    try {
      if (
        digest(await readFile(join(target, name))) !== digest(await readFile(join(staging, name)))
      )
        throw new Error("Frontend asset name collision");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const rank = (name: string) => (name === "sw.js" ? 2 : name.endsWith(".html") ? 1 : 0);
  for (const name of files.sort((a, b) => rank(a) - rank(b))) {
    const destination = join(target, name);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = destination + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporary, await readFile(join(staging, name)));
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }
};

export const buildFrontend = async (
  staging: string,
  target: string,
  build: (directory: string) => Promise<unknown>,
): Promise<void> => {
  try {
    await build(staging);
    await publishFrontend(staging, target);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
