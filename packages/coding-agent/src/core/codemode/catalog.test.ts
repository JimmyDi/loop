import { expect, test } from "vitest";

import { createCodemodeCatalog } from "./catalog";

test("search filters namespaces and describe exposes only one selected schema", async () => {
  const helpers = createCodemodeCatalog(
    [
      {
        name: "read",
        description: "Read a file",
        parameters: { type: "object" },
        execute: () => [],
      },
      {
        name: "external",
        description: "Read external records",
        parameters: { type: "object", required: ["id"] },
        execute: () => [],
      },
    ],
    [{ id: "fixture", name: "Fixture", toolNames: ["external"] }],
  );
  const context = { signal: new AbortController().signal };
  expect(await helpers[0]!.execute(["read", { namespace: "fixture" }], context)).toEqual([
    { name: "external", description: "Read external records", namespace: "fixture" },
  ]);
  expect(await helpers[1]!.execute("external", context)).toMatchObject({
    parameters: { required: ["id"] },
  });
  expect(() => helpers[0]!.execute(["", { limit: 100 }], context)).toThrow("between 1 and 50");
  expect(() => helpers[1]!.execute("unknown", context)).toThrow("Unknown tool");
  expect(() => helpers[1]!.execute("multi_tool_use.parallel", context)).toThrow("Unknown tool");
  expect(await helpers[0]!.execute(["multi_tool_use.parallel"], context)).toEqual([]);
});
