import { expect, test } from "vitest";

import { renderContent } from "../scripts/content-plugin";

const release = {
  schemaVersion: 1 as const,
  version: "1.0.0",
  date: "2026-01-01",
  title: "Loop 1.0.0",
  summary: "Synthetic",
  notes: "Synthetic",
  pages: [
    {
      slug: "web/voice",
      title: "Voice",
      group: "Web",
      source: "packages/web-ui/src/frontend/docs/voice.md",
      markdown: "# Voice",
    },
  ],
};

test("renders safe markdown and resolves links within the same released docs", () => {
  const value = renderContent(
    "## Setup\n\n## Setup\n\n[Voice](docs/voice.md)\n\n[Unsafe](javascript:alert%281%29)\n\n<script>bad()</script>",
    "packages/web-ui/src/frontend/README.md",
    release,
  );
  expect(value.html).toContain('href="docs/1.0.0/web/voice/"');
  expect(value.html).not.toContain("javascript:");
  expect(value.html).not.toContain("<script>");
  expect(value.headings.map((heading) => heading.id)).toEqual(["setup", "setup-1"]);
});
