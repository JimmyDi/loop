export type DocumentationPage = {
  slug: string;
  title: string;
  group: string;
  source: string;
  markdown: string;
};

export type ReleaseContent = {
  schemaVersion: 1;
  version: string;
  date: string;
  title: string;
  summary: string;
  notes: string;
  pages: DocumentationPage[];
};
