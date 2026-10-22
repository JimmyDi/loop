import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

export const mathParser = new Marked(
  { gfm: true, breaks: true },
  markedKatex({ throwOnError: false }),
);
