import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
  const { render, languageBootstrap, routes, releaseFeed } = await import(
    pathToFileURL(resolve(serverOutput, "prerender.js")).href
  );
  const path = "dist/index.html";
  const html = await readFile(path, "utf8");
  for (const route of routes()) {
    const depth = route.split("/").filter(Boolean).length;
    const relativeBase = "../".repeat(depth) || "./";
    const routeBase = base === "./" ? relativeBase : base;
    const target = "dist/" + route + "index.html";
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      html
        .replace(
          new RegExp("<title>[^<]*</title>"),
          "<title>" +
            (route.startsWith("docs/")
              ? "Docs · Loop"
              : route.startsWith("changelog/")
                ? "Changelog · Loop"
                : "Loop") +
            "</title>",
        )
        .replace("<head>", '<head><base href="' + routeBase + '">')
        .replace(
          "<!--language-guard-->",
          '<style>html[data-language-pending] #root{visibility:hidden}</style><script>document.documentElement.dataset.languagePending="true";</script>',
        )
        .replace("<!--app-html-->", render(base, "zh", route))
        .replace(
          "<!--language-bootstrap-->",
          `<template id="initial-english">${render(base, "en", route)}</template><script>${languageBootstrap()}</script>`,
        ),
    );
  }
  const xml = (value) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const origin = "https://jimmydi.github.io/loop/";
  await writeFile(
    "dist/changelog.xml",
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Loop Changelog</title><link>' +
      origin +
      "changelog/</link><description>Published Loop releases</description>" +
      releaseFeed()
        .map(
          (release) =>
            "<item><title>Loop " +
            release.version +
            "</title><link>" +
            origin +
            "changelog/" +
            release.version +
            "/</link><guid>" +
            origin +
            "changelog/" +
            release.version +
            "/</guid><pubDate>" +
            new Date(release.date + "T00:00:00Z").toUTCString() +
            "</pubDate><description>" +
            xml(release.summary) +
            "</description></item>",
        )
        .join("") +
      "</channel></rss>",
  );
} finally {
  await rm(serverOutput, { recursive: true, force: true });
}
