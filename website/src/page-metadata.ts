import { asset } from "./assets";
import { blogPost } from "./blog/blog";
import { normalizeRoute, resolveContentRoute } from "./content-routes";
import type { Language } from "./translations";
import { translations } from "./translations";

export const pageTitle = (path: string, fallback: string, language: Language = "en"): string => {
  const route = normalizeRoute(path);
  if (!route) return fallback;
  if (route.startsWith("blog/"))
    return (
      (route === "blog/"
        ? language === "zh"
          ? "博客"
          : "Blog"
        : (blogPost(route)?.[language].title ??
          (language === "zh" ? "文章不存在" : "Article not found"))) + " · Loop"
    );
  const { kind, release, page, detail } = resolveContentRoute(path);
  if (kind === "docs")
    return (page?.title ?? "Documentation") + " · Loop " + (release?.version ?? "");
  return (detail ? (release?.title ?? "Not found") : "Changelog") + " · Loop";
};

export const pageMetadata = (path: string, language: Language) => {
  const route = normalizeRoute(path);
  const article = blogPost(route)?.[language];
  const title = pageTitle(path, translations[language].title, language);
  const description =
    article?.summary ??
    (route === "blog/"
      ? language === "zh"
        ? "关于 coding agent 的工程思考、产品设计，以及把想法变成代码的过程。"
        : "Engineering, product design and the process of turning ideas into code."
      : translations[language].description);
  return {
    title,
    description,
    socialDescription:
      article || route === "blog/" ? description : translations[language].socialDescription,
  };
};

export const updatePageMetadata = (path: string, language: Language): void => {
  const metadata = pageMetadata(path, language);
  document.title = metadata.title;
  const fields = [
    ['meta[name="description"]', metadata.description],
    ['meta[property="og:title"]', metadata.title],
    ['meta[property="og:description"]', metadata.socialDescription],
  ];
  for (const [selector, value] of fields)
    document.querySelector(selector)?.setAttribute("content", value);
  const article = blogPost(normalizeRoute(path))?.[language];
  document
    .querySelector('meta[property="og:type"]')
    ?.setAttribute("content", article ? "article" : "website");
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) {
    const origin = new URL(canonical.href).origin;
    canonical.href = new URL(asset(normalizeRoute(path)), origin).href;
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical.href);
  }
  for (const [property, value] of [
    ["article:published_time", article?.publishedAt],
    ["article:modified_time", article ? (article.updatedAt ?? article.publishedAt) : undefined],
  ] as const) {
    let tag = document.querySelector<HTMLMetaElement>('meta[property="' + property + '"]');
    if (!value) {
      tag?.remove();
      continue;
    }
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("property", property);
      document.head.append(tag);
    }
    tag.content = value;
  }
  document.getElementById("blog-structured-data")?.remove();
  if (article) {
    const script = document.createElement("script");
    script.id = "blog-structured-data";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.summary,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      inLanguage: language === "zh" ? "zh-CN" : "en",
      author: { "@type": "Organization", name: article.author },
      ...(canonical ? { mainEntityOfPage: canonical.href } : {}),
    });
    document.head.append(script);
  }
};
