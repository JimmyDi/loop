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
if (origin && (base === "./" || !base.startsWith("/") || !base.endsWith("/"))) {
  throw new Error("Public SEO builds require an explicit root-relative --base ending in /.");
}
const serverOutput = ".prerender";

try {
  await build({ base });
  await build({
    base,
    build: {
      ssr: "src/prerender.tsx",
      outDir: serverOutput,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "blog-content", test: /virtual:blog-content/ },
              { name: "release-content", test: /virtual:release-content/ },
            ],
          },
        },
      },
    },
  });
  const { render, languageBootstrap, routes, metadata, blogPosts } = await import(
    pathToFileURL(resolve(serverOutput, "prerender.js")).href
  );
  const path = "dist/index.html";
  const html = await readFile(path, "utf8");
  for (const route of routes()) {
    const language = route.startsWith("en/blog/") ? "en" : "zh";
    const depth = route.split("/").filter(Boolean).length;
    const relativeBase = "../".repeat(depth) || "./";
    const routeBase = base === "./" ? relativeBase : base;
    const target = "dist/" + route + "index.html";
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      routeHead(html, route, metadata(route, language), blogPosts, origin, base)
        .replace(
          '<html lang="zh-CN">',
          '<html lang="' + (language === "en" ? "en" : "zh-CN") + '">',
        )
        .replace("<head>", '<head><base href="' + routeBase + '">')
        .replace(
          "<!--language-guard-->",
          '<style>html[data-language-pending] #root{visibility:hidden}</style><script>document.documentElement.dataset.languagePending="true";</script>',
        )
        .replace('<div id="root">', '<div id="root" data-rendered-language="' + language + '">')
        .replace("<!--app-html-->", render(routeBase, language, route))
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
      .replace('<div id="root">', '<div id="root" data-route="blog/not-found/">')
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
    await writeFile(
      "dist/robots.txt",
      "User-agent: *\nAllow: /\nSitemap: " + new URL(base + "sitemap.xml", origin).href + "\n",
    );
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
