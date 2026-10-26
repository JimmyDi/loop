import { readFile, writeFile } from "node:fs/promises";

export const patchSource = async (file: string, before: string, after: string): Promise<void> => {
  const source = await readFile(file, "utf8");
  if (!source.includes(before)) throw new Error("Voice source patch context changed");
  await writeFile(file, source.replace(before, after));
};
