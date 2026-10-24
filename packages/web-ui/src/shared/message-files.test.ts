import { expect, test } from "vitest";

import { filePreviewType, localFilePath } from "./message-files";

test("local files decode paths without accepting network or unsafe references", () => {
  expect(localFilePath("file:///tmp/report%20file.pdf")).toBe("/tmp/report file.pdf");
  expect(localFilePath("artifacts/movie.mp4")).toBe("artifacts/movie.mp4");
  for (const path of [
    "https://example.test/a",
    "//host/a",
    "file://other/a",
    "#part",
    "a%00b",
    "%xx",
  ])
    expect(localFilePath(path)).toBeUndefined();
  expect(filePreviewType("movie.MP4")).toBe("video");
  expect(filePreviewType("audio.mp3")).toBe("audio");
  expect(filePreviewType("report.pdf")).toBe("pdf");
  expect(filePreviewType("report.docx")).toBeUndefined();
});
