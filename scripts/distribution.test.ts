import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "vitest";

import { inspectDistributionFile, verifyDistribution } from "./distribution";

test.each([
  "src/agent.ts",
  "dist/agent.ts",
  "dist/web/main.tsx",
  "dist/web/assets/main.js.map",
  "dist/sdk.d.ts.map",
  "dist/main.test.js",
  "dist/web/src/main.js",
  "dist/web/.env",
  "dist/web/config.json",
  "dist/../private.js",
  "dist/web/assets/source.zip",
])("rejects source and unexpected publication files: %s", (path) => {
  expect(inspectDistributionFile(path, "").length).toBeGreaterThan(0);
});

test.each([
  ["dist/main.js", "//# sourceMappingURL=data:application/json;base64,e30="],
  ["dist/web/assets/main.css", "/*# sourceMappingURL=main.css.map */"],
  ["dist/main.js", "//@ sourceURL=src/main.ts"],
  ["dist/sdk.d.ts", "//#region src/core/types.d.ts"],
  ["dist/main.js", 'const map = {"sourcesContent": ["source"]};'],
])("rejects source recovery metadata in %s", (path, text) => {
  expect(inspectDistributionFile(path, text).length).toBeGreaterThan(0);
});

test.each([
  ["dist/bin.js", '#!/usr/bin/env node\nconsole.log("Loop");'],
  ["dist/sdk.d.ts", "export declare const createAgentSession: () => void;"],
  ["dist/web/assets/main.js", '/*! @license MIT */ const words = "#region";'],
  ["dist/web/assets/main.css", "body{margin:0}"],
  ["dist/web/THIRD_PARTY_LICENSES.md", "License notices"],
  ["LICENSE", "MIT License"],
])("allows runtime assets, public declarations and licenses: %s", (path, text) => {
  expect(inspectDistributionFile(path, text)).toEqual([]);
});

test("checks generated and installed output and fails on stale source maps", async () => {
  const directory = await mkdtemp(resolve(".package-check-content-"));
  try {
    await mkdir(resolve(directory, "dist/web"), { recursive: true });
    for (const path of ["dist/bin.js", "dist/sdk.js", "dist/sdk.d.ts", "dist/web/index.html"])
      await writeFile(resolve(directory, path), "");
    await verifyDistribution(directory);
    await writeFile(resolve(directory, "package.json"), "{}");
    await mkdir(resolve(directory, "node_modules"));
    await writeFile(resolve(directory, "node_modules/dependency.ts"), "");
    await verifyDistribution(directory, true);
    await writeFile(resolve(directory, "dist/web/main.js.map"), "{}");
    await expect(verifyDistribution(directory)).rejects.toThrow("main.js.map");
    await rm(resolve(directory, "dist/web/main.js.map"));
    await writeFile(resolve(directory, "source.ts"), "");
    await expect(verifyDistribution(directory, true)).rejects.toThrow("source.ts");
    await rm(resolve(directory, "source.ts"));
    await rm(resolve(directory, "dist/sdk.d.ts"));
    await expect(verifyDistribution(directory)).rejects.toThrow("missing entry");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
