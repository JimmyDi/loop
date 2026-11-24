export type DesktopTarget = "darwin-aarch64" | "darwin-x86_64" | "windows-x86_64";

export const desktopReleasesUrl = "https://github.com/JimmyDi/loop/releases";

const api = "https://api.github.com/repos/JimmyDi/loop/releases";

export const latestDesktopDownload = async (
  target: DesktopTarget,
  signal?: AbortSignal,
): Promise<string> => {
  const releases: { version: number[]; url: string }[] = [];
  let page = 1;
  let more = true;
  while (more) {
    const response = await fetch(api + "?per_page=100&page=" + page, {
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error("Desktop release lookup failed");
    const entries = await response.json();
    if (!Array.isArray(entries)) throw new Error("Invalid release response");
    for (const entry of entries) {
      const match = /^desktop-v(\d+)\.(\d+)\.(\d+)$/.exec(entry.tag_name);
      if (!match || entry.draft || entry.prerelease) continue;
      const version = match.slice(1).join(".");
      const filename = {
        "darwin-aarch64": "darwin-aarch64-Loop_" + version + "_aarch64.dmg",
        "darwin-x86_64": "darwin-x86_64-Loop_" + version + "_x64.dmg",
        "windows-x86_64": "windows-x86_64-Loop_" + version + "_x64-setup.exe",
      }[target];
      const url = desktopReleasesUrl + "/download/" + entry.tag_name + "/" + filename;
      if (
        entry.assets?.some(
          (asset: { name: string; browser_download_url: string; state: string }) =>
            asset.name === filename &&
            asset.browser_download_url === url &&
            asset.state === "uploaded",
        )
      )
        releases.push({ version: match.slice(1).map(Number), url });
    }
    more = /<[^>]+>;\s*rel="next"/.test(response.headers.get("Link") ?? "");
    page += 1;
  }
  releases.sort(
    (a, b) =>
      b.version[0]! - a.version[0]! ||
      b.version[1]! - a.version[1]! ||
      b.version[2]! - a.version[2]!,
  );
  if (!releases[0]) throw new Error("Desktop installer unavailable");
  return releases[0].url;
};
