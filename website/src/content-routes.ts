import releases from "virtual:release-content";

export const contentRoutes = (): string[] => [
  "",
  "docs/",
  "changelog/",
  ...releases.map((release) => "changelog/" + release.version + "/"),
  ...releases[0].pages.map((page) => "docs/" + page.slug + "/"),
];

export const normalizeRoute = (path: string): string => {
  const match = path.match(/(?:^|\/)((?:docs|changelog)(?:\/.*)?)$/);
  return match ? match[1].replace(/index\.html$/, "").replace(/\/$/, "") + "/" : "";
};

export const resolveContentRoute = (path: string) => {
  const route = normalizeRoute(path);
  const [kind, version, ...parts] = route.split("/").filter(Boolean);
  if (kind === "docs") {
    const release = releases[0];
    const slug = [version, ...parts].filter(Boolean).join("/") || "getting-started";
    const page = release?.pages.find((entry) => entry.slug === slug);
    return { route, kind, release, page, detail: false };
  }
  const release = !version ? releases[0] : releases.find((entry) => entry.version === version);
  return { route, kind, release, page: undefined, detail: !!version };
};
