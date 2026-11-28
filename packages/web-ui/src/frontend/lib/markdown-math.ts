import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

import { markdownCjk } from "./markdown-cjk";

export const mathParser = new Marked(
  { gfm: true, breaks: true },
  { extensions: [markdownCjk] },
  markedKatex({ throwOnError: false }),
);
