import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const args = process.argv.slice(2);
const baseArgument = args.find((argument) => argument.startsWith("--base="));
const baseIndex = args.indexOf("--base");
const base = baseArgument?.slice(7) ?? (baseIndex >= 0 ? args[baseIndex + 1] : "/");
const serverOutput = ".prerender";

try {
  await build({ base });
  await build({ base, build: { ssr: "src/prerender.tsx", outDir: serverOutput } });
  const { render, languageBootstrap } = await import(
    pathToFileURL(resolve(serverOutput, "prerender.js")).href
  );
  const path = "dist/index.html";
  const html = await readFile(path, "utf8");
  await writeFile(
    path,
    html
      .replace(
        "<!--language-guard-->",
        '<style>html[data-language-pending] #root{visibility:hidden}</style><script>document.documentElement.dataset.languagePending="true";</script>',
      )
      .replace("<!--app-html-->", render(base, "zh"))
      .replace(
        "<!--language-bootstrap-->",
        `<template id="initial-english">${render(base, "en")}</template><script>${languageBootstrap()}</script>`,
      ),
  );
} finally {
  await rm(serverOutput, { recursive: true, force: true });
}
