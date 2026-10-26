import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

import { sourceVoiceModels } from "../resources/catalog";
import { prepareModelFiles } from "./prepare-model-files";

test("prepares every catalog path in an empty directory and reuses verified files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-model-files-"));
  const bytes = Buffer.from("synthetic model or license");
  const fetcher = vi.fn(async () => new Response(bytes));
  vi.stubGlobal("fetch", fetcher);
  try {
    for (const component of sourceVoiceModels) {
      const files = component.files.map((file) => ({
        ...file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }));
      const destination = join(directory, component.id);
      await prepareModelFiles(destination, files);
      for (const file of files) {
        expect(await readFile(join(destination, file.path))).toEqual(bytes);
      }
      const count = fetcher.mock.calls.length;
      await prepareModelFiles(destination, files);
      expect(fetcher).toHaveBeenCalledTimes(count);
    }
  } finally {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  }
});
