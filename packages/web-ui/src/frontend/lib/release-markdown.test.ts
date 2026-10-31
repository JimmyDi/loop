import { expect, test } from "vitest";

import { releaseMarkdown } from "./release-markdown";

test("release links retain their documentation version and external targets", () => {
  const result = releaseMarkdown(
    "[Voice](packages/web-ui/src/frontend/docs/voice.md#usage) [Source](README.md) [External](https://example.com)",
    "1.0.0",
  );
  expect(result).toContain("docs/1.0.0/web/voice/#usage");
  expect(result).toContain("blob/v1.0.0/README.md");
  expect(result).toContain("[External](https://example.com)");
});
