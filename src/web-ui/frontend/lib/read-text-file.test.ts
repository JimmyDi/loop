import { expect, test } from "bun:test";

import { readTextFile } from "./read-text-file";

test("UTF-8 files need no parser and preserve whitespace and BOM text", async () => {
  for (const name of [
    "example.txt",
    "example.ts",
    "example.json",
    "example.csv",
    "example.yaml",
    "Makefile",
  ]) {
    const text = "中文\tvalue\r\n<sample>\n";
    expect(await readTextFile(new File([text], name))).toEqual({ name, text });
  }
  expect(
    await readTextFile(new File([new Uint8Array([239, 187, 191]), "hello"], "bom.txt")),
  ).toEqual({ name: "bom.txt", text: "hello" });
  const text = "中".repeat(512 * 1024);
  expect(await readTextFile(new File([text], "large.txt"))).toEqual({ name: "large.txt", text });
});

test("binary, invalid UTF-8 and unsupported files reject without decoding replacements", async () => {
  for (const bytes of [
    new Uint8Array([0, 1, 2]),
    new Uint8Array([195, 40]),
    new Uint8Array([255, 254, 65, 0]),
  ]) {
    await expect(readTextFile(new File([bytes], "example.txt"))).rejects.toMatchObject({
      code: "invalid_text_encoding",
    });
  }
  await expect(readTextFile(new File(["document"], "example.pdf"))).rejects.toMatchObject({
    code: "invalid_text_files",
  });
});
