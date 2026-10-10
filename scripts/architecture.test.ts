import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import glob from "fast-glob";
import { expect, test } from "vitest";

import { root, inspectImports, cycles } from "./architecture";

test("production packages enforce downward public boundaries, declared dependencies and no cycles", async () => {
  const files = await glob(["packages/*/src/**/*.{ts,tsx,js}", "bin.ts", "sdk.ts"], {
    cwd: root,
    absolute: true,
    ignore: ["**/*.test.*", "**/dist/**", "**/node_modules/**"],
  });
  const failures: string[] = [];
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const result = inspectImports(file, await readFile(file, "utf8"));
    failures.push(...result.failures);
    graph.set(file.replaceAll("\\", "/"), result.edges);
  }
  expect(failures).toEqual([]);
  expect(cycles(graph)).toEqual([]);
  const agent = (await readdir(resolve(root, "packages/agent/src")))
    .filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".sample.ts"),
    )
    .sort();
  expect(agent).toEqual([
    "abortable-promise.ts",
    "agent-loop.ts",
    "agent.ts",
    "execute-tool.ts",
    "index.ts",
    "normalize-model-input.ts",
    "stream-model-response.ts",
    "types.ts",
    "validate-loop-input.ts",
  ]);
});

test.each([
  ["agent/src/agent.ts", 'import type { AgentSession } from "@loop/coding-agent";'],
  ["agent/src/index.ts", 'export * from "@loop/web-ui";'],
  ["coding-agent/src/core/sdk.ts", 'import "../main";'],
  ["coding-agent/src/core/sdk.ts", 'import("../modes");'],
  ["coding-agent/src/core/sdk.ts", 'import("@loop/web-ui");'],
  ["coding-agent/src/core/sdk.ts", 'require("@loop/agent/internal");'],
  ["coding-agent/src/index.ts", 'import "../../agent/src/index";'],
  ["coding-agent/src/core/sdk.ts", 'import "@earendil-works/pi-ai";'],
  ["web-ui/src/backend/loop.ts", 'import "@loop/agent";'],
  ["web-ui/src/backend/loop.ts", 'import type { X } from "@loop/coding-agent/core/sdk";'],
  ["web-ui/src/frontend/main.tsx", 'import "@loop/coding-agent";'],
  ["web-ui/src/shared/protocol.ts", 'import "node:fs";'],
  ["web-ui/src/frontend/main.tsx", 'export * from "../backend/server";'],
  ["web-ui/src/backend/loop.ts", "import(moduleName);"],
  ["web-ui/src/backend/loop.ts", 'import "./loop.test";'],
])("rejects forbidden import from %s", (file, source) => {
  expect(inspectImports(resolve(root, "packages", file), source).failures.length).toBeGreaterThan(
    0,
  );
});

test.each([
  ["web-ui/src/backend/loop.ts", 'import { createAgentSession } from "@loop/coding-agent";'],
  ["web-ui/src/shared/protocol.ts", 'import type { SessionEvent } from "@loop/coding-agent";'],
  [
    "coding-agent/src/core/model-runtime.ts",
    'import { createModels } from "@earendil-works/pi-ai";',
  ],
  ["agent/src/agent-loop.ts", 'import { Type } from "@earendil-works/pi-ai";'],
])("allows public imports from %s", (file, source) => {
  expect(inspectImports(resolve(root, "packages", file), source).failures).toEqual([]);
});

test("runtime cycles are rejected", () => {
  expect(
    cycles(
      new Map([
        ["a", ["b"]],
        ["b", ["a"]],
      ]),
    ),
  ).toHaveLength(1);
});

test("workspace manifests declare only downward package dependencies and explicit exports", async () => {
  const allowed: Record<string, string[]> = {
    agent: [],
    "coding-agent": ["@loop/agent"],
    "web-ui": ["@loop/coding-agent"],
  };
  for (const [name, dependencies] of Object.entries(allowed)) {
    const manifest = JSON.parse(
      await readFile(resolve(root, "packages", name, "package.json"), "utf8"),
    );
    expect(
      Object.keys(manifest.dependencies ?? {})
        .filter((key) => key.startsWith("@loop/"))
        .sort(),
    ).toEqual(dependencies);
    expect(Object.keys(manifest.exports).sort()).toEqual(
      name === "coding-agent" ? [".", "./cli"] : ["."],
    );
    expect(manifest.exports["."].import).toBe("./dist/index.js");
    expect(manifest.exports["."].types).toBe("./dist/index.d.ts");
  }
});
