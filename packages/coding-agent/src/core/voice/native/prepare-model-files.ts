import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { downloadResource, matchesResource } from "../resources/download";
import type { VoiceResourceFile } from "../resources/resource-types";

export const prepareModelFiles = async (
  directory: string,
  files: readonly VoiceResourceFile[],
): Promise<void> => {
  for (const file of files) {
    const destination = join(directory, file.path);
    if (await matchesResource(destination, file)) continue;
    await mkdir(dirname(destination), { recursive: true });
    await downloadResource(file, destination, AbortSignal.timeout(900_000), () => {});
  }
};
