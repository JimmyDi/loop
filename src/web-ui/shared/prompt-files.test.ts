import { expect, test } from "bun:test";

import { fileContent, readFileContent, validTextFiles } from "./prompt-files";
import { promptContent } from "./prompt-images";

test("text attachments validate names, controls, Unicode and count", () => {
  const file = { name: "example.ts", text: "const example = 1;\n" };
  expect(validTextFiles([file])).toBe(true);
  expect(validTextFiles([{ name: "Makefile", text: "\tbuild\r\n" }])).toBe(true);
  expect(validTextFiles([{ name: "example.md", text: "中文 😀" }])).toBe(true);
  expect(validTextFiles([{ name: "empty.txt", text: "" }])).toBe(true);
  expect(validTextFiles([])).toBe(true);
  for (const value of [
    null,
    {},
    [null],
    Array(5).fill(file),
    [{ ...file, name: "../example.ts" }],
    [{ ...file, name: "example.pdf" }],
    [{ ...file, name: "example.zip" }],
    [{ ...file, text: "binary\0text" }],
    [{ ...file, text: "\ud800" }],
  ])
    expect(validTextFiles(value)).toBe(false);
});

test("large text files preserve exact Unicode without per-file or combined byte limits", () => {
  const text = "中".repeat(512 * 1024) + "x";
  const files = [
    { name: "one.txt", text },
    { name: "two.txt", text },
  ];
  expect(validTextFiles(files)).toBe(true);
  expect(readFileContent(fileContent(files[0]!))).toEqual(files[0]);
  expect(validTextFiles([{ ...files[0]!, text: text + "x" }])).toBe(true);
  expect(validTextFiles([...files, { name: "extra.txt", text: "x" }])).toBe(true);
});

test("file blocks round-trip exact text and filenames through native Pi content", () => {
  const file = { name: "example.md", text: "```ts\nconst sample = '<tag>';\n```\n中文\r\n" };
  const block = { type: "text" as const, text: fileContent(file) };
  expect(readFileContent(block.text)).toEqual(file);
  expect(promptContent("", [], [file])).toEqual([block]);
  const image = { type: "image" as const, mimeType: "image/png", data: "AAAA" };
  expect(promptContent("Review", [image], [file])).toEqual([
    { type: "text", text: "Review" },
    image,
    block,
  ]);
  expect(readFileContent("Ordinary text")).toBeUndefined();
  expect(readFileContent(fileContent(file).slice(0, -1))).toBeUndefined();
});
