import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const documents = new Set(["package.json", "README.md", "LICENSE", "CHANGELOG.md"]);
const webDocuments = new Set(["dist/web/BRAND-ASSETS.md", "dist/web/THIRD_PARTY_LICENSES.md"]);

export const inspectDistributionFile = (path: string, text: string): string[] => {
  const failures: string[] = [];
  const safePath = !path.split("/").some((part) => !part || part === "." || part === "..");
  const allowed =
    documents.has(path) ||
    webDocuments.has(path) ||
    /^dist\/[^/]+\.(?:js|d\.ts)$/.test(path) ||
    /^dist\/web\/(?:[^/]+\/)*[^/]+\.(?:html|js|css|svg|png|ico|woff2?|ttf)$/.test(path);

  if (!safePath || !allowed || /(?:^|\/)(?:src|node_modules|\.[^/]+)(?:\/|$)/.test(path))
    failures.push(path + ": unexpected publication file");
  if (/(?:^|[./-])(?:test|spec|sample|config)\./.test(path))
    failures.push(path + ": development file");
  if (/\.(?:js|ts|css|html|svg|json)$/.test(path)) {
    if (/(?:\/\/|\/\*)\s*[#@]\s*(?:sourceMappingURL|sourceURL)\s*=/.test(text))
      failures.push(path + ": source map or source URL directive");
    if (/(?:\/\/|\/\*)\s*#(?:end)?region\b/.test(text))
      failures.push(path + ": source-location region comment");
    if (/"sourcesContent"\s*:/.test(text)) failures.push(path + ": embedded source map content");
  }
  return failures;
};

export const verifyDistribution = async (directory: string, installed = false): Promise<void> => {
  const failures: string[] = [];
  const files = new Set<string>();
  const visit = async (folder: string): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      const path = relative(directory, file).split(sep).join("/");
      if (installed && path === "node_modules") continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) {
        files.add(path);
        failures.push(...inspectDistributionFile(path, await readFile(file, "utf8")));
      } else failures.push(path + ": non-regular publication file");
    }
  };
  if (installed) await visit(directory);
  else await visit(join(directory, "dist"));
  for (const required of ["dist/bin.js", "dist/sdk.js", "dist/sdk.d.ts", "dist/web/index.html"]) {
    if (!files.has(required)) failures.push(required + ": missing entry");
  }
  if (failures.length)
    throw new Error("Distribution content check failed:\n" + failures.join("\n"));
};
