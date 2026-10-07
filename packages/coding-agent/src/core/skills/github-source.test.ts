import { expect, test, vi } from "vitest";

import { parseGitHubSource, readGitHubBundles } from "./github-source";

test("resolves an immutable commit, copies nested assets, and rejects unsafe URLs", async () => {
  for (const url of [
    "https://example.com/repo",
    "https://github.com/example/repo?token=synthetic",
    "http://github.com/example/repo",
    "https://github.com/example/repo/tree/main/../secret",
  ])
    expect(() => parseGitHubSource(url)).toThrow();
  const files = new Map([
    [
      "workflows/example/SKILL.md",
      "---\nname: example\ndescription: Review source\n---\nUse references.",
    ],
    ["workflows/example/references/guide.md", "Reference body."],
  ]);
  const urls: string[] = [];
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/commits/")) return Response.json({ sha: "immutable-commit" });
    if (url.includes("/git/trees/"))
      return Response.json({
        tree: [...files].map(([path, content], index) => ({
          path,
          type: "blob",
          mode: "100644",
          sha: "blob-" + index,
          size: Buffer.byteLength(content),
        })),
      });
    if (url.includes("/git/blobs/"))
      return Response.json({
        content: Buffer.from([...files.values()][Number(url.split("-").at(-1))]!).toString(
          "base64",
        ),
      });
    throw new Error("unexpected URL");
  });
  try {
    const result = await readGitHubBundles(
      { kind: "github", location: "https://github.com/example/repo/tree/main/workflows/example" },
      new AbortController().signal,
    );
    expect(result.source.revision).toBe("immutable-commit");
    expect(result.bundles[0]!.candidate.files).toEqual(["SKILL.md", "references/guide.md"]);
    expect(urls.some((url) => url.includes("/git/trees/immutable-commit"))).toBe(true);
  } finally {
    fetch.mockRestore();
  }
});
