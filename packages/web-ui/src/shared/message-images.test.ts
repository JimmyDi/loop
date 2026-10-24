import { expect, test } from "vitest";

import { localImagePath } from "./message-images";

test("local image references decode paths and reject remote and executable formats", () => {
  expect(localImagePath("shots/a%20b.png")).toBe("shots/a b.png");
  expect(localImagePath("file:///tmp/shot.png")).toBe("/tmp/shot.png");
  for (const value of [
    "https://example.test/a.png",
    "//example.test/a.png",
    "file://other/a.png",
    "a.svg",
    "a.html",
    "bad%zz.png",
  ])
    expect(localImagePath(value)).toBeUndefined();
});
