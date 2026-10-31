export const websiteUrl = "https://jimmydi.github.io/loop/";

export const releaseDocsUrl = (): string => websiteUrl + "docs/";

export const releaseNotesUrl = (version?: string): string =>
  websiteUrl + "changelog/" + (version ? version + "/" : "");
