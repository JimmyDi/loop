export const websiteUrl = "https://jimmydi.github.io/loop/";

export const releaseDocsUrl = (version?: string): string =>
  websiteUrl + "docs/" + (version ? version + "/getting-started/" : "");

export const releaseNotesUrl = (version?: string): string =>
  websiteUrl + "changelog/" + (version ? version + "/" : "");
