import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { Canvas, FontLibrary } = createRequire(import.meta.url)("skia-canvas");
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, "../../..");
const monoFont = process.argv[2];

if (!monoFont) {
  throw new Error("Usage: node docs/assets/readme/generate-brand.mjs /path/to/monospace.ttf");
}

FontLibrary.use(
  "LoopReadme",
  resolve(root, "website/public/fonts/montserrat-latin-wght-normal.woff2"),
);
FontLibrary.use("LoopReadmeMono", resolve(monoFont));

const context = new Canvas(350, 232).getContext("2d");

context.font = "650 64px LoopReadme";
context.letterSpacing = "-3px";
const wordmark = context.outlineText("Loop").d;

context.font = "400 14px LoopReadmeMono";
context.letterSpacing = "1.5px";
const tagline = ["LOCAL-FIRST", "OPEN-SOURCE CODING HARNESS"].map(
  (line) => context.outlineText(line).d,
);

for (const theme of ["light", "dark"]) {
  const iconName = theme === "dark" ? "loop-icon-light.svg" : "loop-icon.svg";
  const icon = readFileSync(
    resolve(root, "packages/web-ui/src/docs/assets/loop-brand/svg", iconName),
    "utf8",
  )
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/\s*<(title|desc)>[\s\S]*?<\/\1>/g, "");
  const text = theme === "dark" ? "#f0f3f6" : "#1f2328";
  const muted = theme === "dark" ? "#919aa6" : "#636c76";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="232" viewBox="0 0 350 232" fill="none" role="img" aria-labelledby="title description">',
    '<title id="title">Loop</title>',
    '<desc id="description">Local-first. Open-source coding harness.</desc>',
    "<metadata>Wordmark outlines: Montserrat, Copyright 2011 The Montserrat Project Authors, SIL OFL 1.1. The Loop icon retains its original brand asset policy.</metadata>",
    '<g transform="translate(0 35) scale(1.25)">' + icon + "</g>",
    '<path d="' + wordmark + '" transform="translate(92 99)" fill="' + text + '"/>',
    '<path d="' + tagline[0] + '" transform="translate(0 166)" fill="' + muted + '"/>',
    '<path d="' + tagline[1] + '" transform="translate(0 190)" fill="' + muted + '"/>',
    "</svg>",
    "",
  ].join("\n");
  writeFileSync(resolve(output, "brand-" + theme + ".svg"), svg);
}
