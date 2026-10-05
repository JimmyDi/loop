import { expect, test } from "vitest";

import { MAX_IMAGE_BYTES, promptContent, validImages } from "./prompt-images";

test("image content bounds MIME, base64, count and total decoded bytes", () => {
  const image = { type: "image" as const, data: "AAAA", mimeType: "image/png" };
  expect(validImages([image])).toBe(true);
  expect(validImages([])).toBe(true);
  for (const images of [
    null,
    {},
    [null],
    Array(5).fill(image),
    [{ ...image, mimeType: "image/svg+xml" }],
    [{ ...image, data: "http://example.com" }],
    [{ ...image, data: "A===" }],
  ])
    expect(validImages(images)).toBe(false);
  const large = { ...image, data: Buffer.alloc(MAX_IMAGE_BYTES).toString("base64") };
  expect(validImages([large])).toBe(true);
  expect(validImages([large, image])).toBe(false);
  expect(promptContent("Text")).toBe("Text");
  expect(promptContent("", [image])).toEqual([image]);
  expect(promptContent("Text", [image])).toEqual([{ type: "text", text: "Text" }, image]);
});
