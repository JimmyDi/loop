import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import posts from "virtual:blog-content";

import { pageMetadata, updatePageMetadata } from "../page-metadata";
import { App } from "../App";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { publicOrigin, routeHead } from "../../scripts/blog-head.mjs";

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
});

it("updates article metadata by language and removes article fields on leaving", () => {
  document.head.innerHTML =
    '<meta name="description"><meta property="og:title"><meta property="og:type"><meta property="og:description"><link rel="canonical" href="https://example.com/blog/">';
  const route = "blog/" + posts[0].slug + "/";
  updatePageMetadata(route, "en");
  expect(document.title).toBe(posts[0].en.title + " · Loop");
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
    posts[0].en.summary,
  );
  expect(JSON.parse(document.getElementById("blog-structured-data")!.textContent!).inLanguage).toBe(
    "en",
  );
  updatePageMetadata("blog/", "zh");
  expect(document.querySelector('meta[property="article:published_time"]')).toBeNull();
  expect(document.getElementById("blog-structured-data")).toBeNull();
});

it("writes static route metadata with deployment base and excludes preview origins", () => {
  const template =
    '<head><title>Home</title><meta name="description" content="Home"><meta property="og:type" content="website"></head>';
  const route = "blog/" + posts[0].slug + "/";
  const html = routeHead(
    template,
    route,
    pageMetadata(route, "zh"),
    posts,
    publicOrigin("https://example.com"),
    "/loop/",
  );
  expect(html).toContain('href="https://example.com/loop/' + route + '"');
  expect(html).toContain('"@type":"BlogPosting"');
  expect(() => publicOrigin("https://localhost")).toThrow();
  expect(
    routeHead(template, route, pageMetadata(route, "zh"), posts, undefined, "/"),
  ).not.toContain('rel="canonical"');
});

it("uses a blog missing page for unknown slugs", () => {
  const view = render(
    <LanguageProvider initialLanguage="en">
      <App path="blog/missing/" />
    </LanguageProvider>,
  );
  expect(view.container.textContent).toContain("Article not found");
  expect(view.container.textContent).not.toContain("From idea,");
});
