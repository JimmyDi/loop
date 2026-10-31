declare module "virtual:loop-releases" {
  const content: {
    version: string;
    docsVersion?: string;
    releases: { version: string; date: string; title: string; summary: string; notes: string }[];
  };
  export default content;
}
