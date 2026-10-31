import releases from "virtual:release-content";

export const contentRoutes = (): string[] => [
  "",
  "docs/",
  "changelog/",
  ...releases.flatMap((release) => [
    "changelog/" + release.version + "/",
    ...(release.pages.length ? ["docs/" + release.version + "/"] : []),
    ...release.pages.map((page) => "docs/" + release.version + "/" + page.slug + "/"),
  ]),
  ...releases[0].pages.map((page) => "docs/latest/" + page.slug + "/"),
  "docs/latest/",
];

export const normalizeRoute = (path: string): string => {
  const match = path.match(/(?:^|\/)((?:docs|changelog)(?:\/.*)?)$/);
  return match ? match[1].replace(/index\.html$/, "").replace(/\/$/, "") + "/" : "";
};

export const resolveContentRoute = (path: string) => {
  const route = normalizeRoute(path);
  const [kind, version, ...parts] = route.split("/").filter(Boolean);
  const release =
    !version || version === "latest"
      ? releases[0]
      : releases.find((entry) => entry.version === version);
  const slug = parts.join("/") || "getting-started";
  const page = release?.pages.find((entry) => entry.slug === slug);
  return { route, kind, release, page, detail: kind === "changelog" && !!version };
};
