declare module "virtual:release-content" {
  type Page = {
    slug: string;
    title: string;
    group: string;
    html: string;
    search: string;
    headings: { id: string; title: string }[];
  };
  type Release = {
    version: string;
    date: string;
    title: string;
    summary: string;
    html: string;
    headings: { id: string; title: string }[];
    pages: Page[];
  };
  const releases: Release[];
  export default releases;
}
