const escape = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

export const publicOrigin = (value) => {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|\[::1\])/.test(url.hostname)
  )
    throw new Error("WEBSITE_ORIGIN must be a public HTTPS origin.");
  return url.origin;
};

export const routeHead = (html, route, metadata, posts, origin, base) => {
  const post = posts.find((entry) => route === "blog/" + entry.slug + "/")?.zh;
  const result = html
    .replace(/<title>[^<]*<\/title>/, "<title>" + escape(metadata.title) + "</title>")
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*("\s*>)/,
      (_, a, b) => a + escape(metadata.description) + b,
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*("\s*>)/,
      (_, a, b) => a + escape(metadata.title) + b,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*("\s*>)/,
      (_, a, b) => a + escape(metadata.socialDescription) + b,
    )
    .replace('content="website"', 'content="' + (post ? "article" : "website") + '"');
  const url = origin ? new URL((base === "./" ? "/" : base) + route, origin).href : undefined;
  let head = url
    ? '<link rel="canonical" href="' +
      escape(url) +
      '"><meta property="og:url" content="' +
      escape(url) +
      '">'
    : "";
  if (post) {
    head +=
      '<meta property="article:published_time" content="' +
      post.publishedAt +
      '"><meta property="article:modified_time" content="' +
      (post.updatedAt ?? post.publishedAt) +
      '">';
    head +=
      '<script id="blog-structured-data" type="application/ld+json">' +
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.summary,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        inLanguage: "zh-CN",
        author: { "@type": "Organization", name: post.author },
        ...(url ? { mainEntityOfPage: url } : {}),
      }).replaceAll("<", "\\u003c") +
      "</script>";
  }
  return result.replace("</head>", head + "</head>");
};
