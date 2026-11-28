import { expect, test } from "vitest";

import { splitOpenUiBlocks } from "./openui-blocks";

const source = 'root = Table("Test results", ["Name"], [])';
const open = "```openui\n" + source;
const closed = open + "\n```";

test("only extracts top-level OpenUI fences and keeps surrounding Markdown", () => {
  expect(splitOpenUiBlocks("Before\n\n" + closed + "\n\nAfter", false, true)).toEqual([
    { type: "markdown", raw: "Before\n\n", offset: 0 },
    { type: "openui", raw: closed, offset: 8, response: source, streaming: false },
    { type: "markdown", raw: "\n\nAfter", offset: 8 + closed.length },
  ]);
  for (const raw of [
    "````markdown\n" + closed + "\n````",
    closed
      .split("\n")
      .map((line) => "> " + line)
      .join("\n"),
    "- example\n\n" +
      closed
        .split("\n")
        .map((line) => "  " + line)
        .join("\n"),
  ]) {
    expect(splitOpenUiBlocks(raw, false, true)).toEqual([{ type: "markdown", raw, offset: 0 }]);
  }
});

test("requires a complete fence in saved replies and preserves the opening offset in drafts", () => {
  expect(splitOpenUiBlocks(open, false, true)).toEqual([
    { type: "markdown", raw: open, offset: 0 },
  ]);
  expect(splitOpenUiBlocks(open, true, true)).toEqual([
    { type: "openui", raw: open, offset: 0, response: source, streaming: true },
  ]);
  expect(splitOpenUiBlocks(closed, true, true)[0]).toMatchObject({ offset: 0, streaming: false });
  expect(splitOpenUiBlocks(closed, false, false)).toEqual([
    { type: "markdown", raw: closed, offset: 0 },
  ]);
});
