let assetBase =
  typeof document !== "undefined" && document.querySelector("base")
    ? new URL(document.baseURI).pathname
    : import.meta.env.BASE_URL;

export const setPrerenderAssetBase = (base: string): void => {
  assetBase = base.endsWith("/") ? base : base + "/";
};

export const asset = (path: string): string => assetBase + path;
