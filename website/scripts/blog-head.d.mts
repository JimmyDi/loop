import type { BlogPost } from "../src/blog/types";

export const publicOrigin: (value: string | undefined) => string | undefined;

export const routeHead: (
  html: string,
  route: string,
  metadata: { title: string; description: string; socialDescription: string },
  posts: BlogPost[],
  origin: string | undefined,
  base: string,
) => string;
