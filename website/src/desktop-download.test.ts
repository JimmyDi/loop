import { afterEach, expect, test, vi } from "vitest";

import { latestDesktopDownload } from "./desktop-download";

const release = (version: string, prerelease = false) => ({
  tag_name: "desktop-v" + version,
  draft: false,
  prerelease,
  assets: [
    ["darwin-aarch64", "aarch64.dmg"],
    ["darwin-x86_64", "x64.dmg"],
    ["windows-x86_64", "x64-setup.exe"],
  ].map(([target, suffix]) => ({
    name: target + "-Loop_" + version + "_" + suffix,
    state: "uploaded",
    browser_download_url:
      "https://github.com/JimmyDi/loop/releases/download/desktop-v" +
      version +
      "/" +
      target +
      "-Loop_" +
      version +
      "_" +
      suffix,
  })),
});

afterEach(() => vi.unstubAllGlobals());

test.each(["darwin-aarch64", "darwin-x86_64", "windows-x86_64"] as const)(
  "finds the newest stable %s installer across pages",
  async (target) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([release("0.9.0"), release("1.0.0", true), { tag_name: "v3.0.0" }]),
          { headers: { Link: '<https://api.github.com/next>; rel="next"' } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([release("0.10.0"), release("0.8.0")])));
    vi.stubGlobal("fetch", fetcher);
    const url = await latestDesktopDownload(target);
    expect(url).toContain("/desktop-v0.10.0/" + target + "-Loop_0.10.0_");
    expect(fetcher.mock.calls[1]?.[0]).toContain("page=2");
    expect(fetcher.mock.calls[0]?.[1].cache).toBe("no-store");
  },
);

test("refreshes the release lookup on every download", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([release("0.9.0")])))
    .mockResolvedValueOnce(new Response(JSON.stringify([release("0.9.1")])));
  vi.stubGlobal("fetch", fetcher);
  expect(await latestDesktopDownload("darwin-aarch64")).toContain("desktop-v0.9.0/");
  expect(await latestDesktopDownload("darwin-aarch64")).toContain("desktop-v0.9.1/");
});

test("rejects unavailable assets, drafts, and unexpected download hosts", async () => {
  const invalid = release("0.9.1");
  invalid.assets.forEach((asset) => {
    asset.browser_download_url = "https://example.com/installer";
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([invalid, { ...release("0.9.0"), draft: true }])),
      ),
  );
  await expect(latestDesktopDownload("darwin-aarch64")).rejects.toThrow("unavailable");
});

test("reports API failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  await expect(latestDesktopDownload("windows-x86_64")).rejects.toThrow("lookup failed");
});
