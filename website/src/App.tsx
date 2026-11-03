import { useEffect, useState } from "react";

import { Capabilities } from "./components/Capabilities";
import { Hero } from "./components/Hero";
import { Interfaces } from "./components/Interfaces";
import layout from "./components/Layout.module.css";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { useLanguage } from "./i18n/useLanguage";
import { normalizeRoute } from "./content-routes";
import { asset } from "./assets";
import { DocsPage } from "./components/DocsPage";
import { ChangelogPage } from "./components/ChangelogPage";
import { useContentNavigation } from "./components/useContentNavigation";
import { BlogPage } from "./components/BlogPage";
import { BlogArticle } from "./components/BlogArticle";
import { updatePageMetadata } from "./page-metadata";
import appStyles from "./App.module.css";
import { pageTitle } from "./page-metadata";

export const App = ({
  path = typeof location === "undefined" ? "" : location.pathname,
}: {
  path?: string;
}) => {
  const { t, language } = useLanguage();
  const [initialRoute] = useState(() => normalizeRoute(path));
  const navigation = useContentNavigation(initialRoute);
  const route = navigation.route;
  useEffect(() => {
    document.title = pageTitle(route, t("title"), language);
    updatePageMetadata(route, language);
  }, [route, language, t]);
  return (
    <div
      ref={navigation.ref}
      aria-busy={navigation.pending}
      className={route.startsWith("blog/") ? appStyles.blog : undefined}
    >
      <a className={layout["skip-link"]} href={asset(route + "#main")}>
        {t("skip")}
      </a>
      <SiteHeader route={route} />
      <span className={appStyles.status} role="status">
        {navigation.pending ? (language === "zh" ? "正在加载文章" : "Loading article") : ""}
      </span>
      <main id="main">
        {route === "blog/" ? (
          <BlogPage />
        ) : route.startsWith("blog/") ? (
          <BlogArticle route={route} bodies={navigation.bodies} />
        ) : route.startsWith("docs/") ? (
          <DocsPage route={route} html={navigation.html} />
        ) : route.startsWith("changelog/") ? (
          <ChangelogPage route={route} html={navigation.html} />
        ) : (
          <>
            <Hero />
            <Capabilities />
            <Interfaces />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};
