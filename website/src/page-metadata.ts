import { normalizeRoute, resolveContentRoute } from "./content-routes";

export const pageTitle = (path: string, fallback: string): string => {
  if (!normalizeRoute(path)) return fallback;
  const { kind, release, page, detail } = resolveContentRoute(path);
  if (kind === "docs")
    return (page?.title ?? "Documentation") + " · Loop " + (release?.version ?? "");
  return (detail ? (release?.title ?? "Not found") : "Changelog") + " · Loop";
};
