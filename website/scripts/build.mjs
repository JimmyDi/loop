import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

import { publicOrigin, routeHead } from "./blog-head.mjs";

const args = process.argv.slice(2);
const baseArgument = args.find((argument) => argument.startsWith("--base="));
const baseIndex = args.indexOf("--base");
const base = baseArgument?.slice(7) ?? (baseIndex >= 0 ? args[baseIndex + 1] : "/");
const origin = publicOrigin(process.env.WEBSITE_ORIGIN);
const serverOutput = ".prerender";

try {
  await build({ base });
  await build({ base, build: { ssr: "src/prerender.tsx", outDir: serverOutput } });
  const { render, languageBootstrap, routes, metadata, blogPosts } = await import(
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
      routeHead(html, route, metadata(route, "zh"), blogPosts, origin, base)
        .replace("<head>", '<head><base href="' + routeBase + '">')
        .replace(
          "<!--language-guard-->",
          '<style>html[data-language-pending] #root{visibility:hidden}</style><script>document.documentElement.dataset.languagePending="true";</script>',
        )
        .replace("<!--app-html-->", render(routeBase, "zh", route))
        .replace(
          "<!--language-bootstrap-->",
          `<template id="initial-english">${render(routeBase, "en", route)}</template><script>${languageBootstrap(route)}</script>`,
        ),
    );
  }
  const notFound = "blog/not-found/";
  await writeFile(
    "dist/404.html",
    routeHead(html, notFound, metadata(notFound, "zh"), [], undefined, base)
      .replace(
        "<head>",
        '<head><base href="' +
          (base === "./" ? "/" : base) +
          '"><meta name="robots" content="noindex">',
      )
      .replace("<!--app-html-->", render(base === "./" ? "/" : base, "zh", notFound))
      .replace(
        "<!--language-bootstrap-->",
        '<template id="initial-english">' +
          render(base === "./" ? "/" : base, "en", notFound) +
          "</template><script>" +
          languageBootstrap(notFound) +
          "</script>",
      ),
  );
  if (origin && base !== "./") {
    const urls = routes().map((route) => new URL(base + route, origin).href);
    await writeFile(
      "dist/sitemap.xml",
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        urls.map((url) => "<url><loc>" + url.replaceAll("&", "&amp;") + "</loc></url>").join("") +
        "</urlset>",
    );
  }
} finally {
  await rm(serverOutput, { recursive: true, force: true });
}
