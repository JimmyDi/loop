import { createParser } from "@openuidev/react-lang";
import { expect, test } from "vitest";
import { z } from "zod";

import { openUiLibrary as renderLibrary } from "../frontend/lib/openui-render-library";
import { openUiLibrary, openUiTopicComponents } from "../shared/openui-library";
import { openUiDocsTool } from "./openui-prompt";

const parser = createParser(renderLibrary.toJSONSchema(), renderLibrary.root);
const spec = openUiLibrary.toSpec();
const { properties, additionalProperties, required } = openUiDocsTool.parameters;
const topics = z.object({ enum: z.array(z.string()).min(1) }).parse(properties?.topic).enum;

const loadDocs = async (topic: string) => {
  const result = await openUiDocsTool.execute({ topic }, new AbortController().signal);
  expect(result[0]?.type).toBe("text");
  return result[0]?.type === "text" ? result[0].text : "";
};

test.each(topics)("loads and parses the %s example with the rendered library", async (topic) => {
  const text = await loadDocs(topic);
  const [signatures, example] = text.split("\n\nExample:\n");
  expect(example).toBeTruthy();
  const parsed = parser.parse(example!);
  expect(parsed.meta.errors.filter(({ severity }) => severity !== "warning")).toEqual([]);
  expect(parsed.meta.incomplete).toBeFalsy();
  expect(parsed.root || parsed.rootExpression).toBeTruthy();
  if (topic === "sales") expect(parsed.queryStatements).toHaveLength(1);

  const lines = signatures?.split("\n\n") ?? [];
  const expected = new Set(
    [...openUiTopicComponents].flatMap(([key, names]) => (key === topic ? names : [])),
  );
  for (const name of new Set([...openUiTopicComponents.values()].flat())) {
    const signature = spec.components[name]?.signature;
    expect(signature).toBeTruthy();
    const visible = lines.some((line) => line === signature || line.startsWith(signature + " — "));
    expect(visible).toBe(expected.has(name));
  }
});

test("advertises a documentation topic for every tagged component", () => {
  expect(topics).toEqual(expect.arrayContaining([...openUiTopicComponents.keys()]));
});

test("rejects missing, unknown, mistyped, and extra tool arguments", async () => {
  expect(additionalProperties).toBe(false);
  expect(required).toEqual(["topic"]);
  for (const args of [{}, { topic: "unknown" }, { topic: 12 }, { topic: "maps", extra: true }]) {
    await expect(openUiDocsTool.execute(args, new AbortController().signal)).rejects.toBeInstanceOf(
      z.ZodError,
    );
  }
});
