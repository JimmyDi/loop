import { websiteUrl } from "./release-links";

export const releaseMarkdown = (notes: string, version: string): string =>
  notes.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (original, label: string, target: string) => {
    if (/^(https?:|#)/.test(target)) return original;
    const prefixes = [
      ["packages/web-ui/src/frontend/docs/", "web/"],
      ["packages/coding-agent/src/docs/", "coding-agent/"],
      ["packages/agent/src/docs/", "agent/"],
      ["packages/web-ui/src/backend/docs/", "server/"],
    ];
    const prefix = prefixes.find(
      ([source]) => target.startsWith(source) && target.split("#")[0].endsWith(".md"),
    );
    const [path, hash] = target.split("#");
    const url = prefix
      ? websiteUrl +
        "docs/" +
        prefix[1] +
        path.slice(prefix[0].length, -3) +
        "/" +
        (hash ? "#" + hash : "")
      : "https://github.com/JimmyDi/loop/blob/v" + version + "/" + target;
    return "[" + label + "](" + url + ")";
  });
