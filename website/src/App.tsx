import { useEffect } from "react";

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
import { pageTitle } from "./page-metadata";

export const App = ({
  path = typeof location === "undefined" ? "" : location.pathname,
}: {
  path?: string;
}) => {
  const { t } = useLanguage();
  const navigation = useContentNavigation(normalizeRoute(path));
  const route = navigation.route;
  useEffect(() => {
    document.title = pageTitle(route, t("title"));
  }, [route, t]);
  return (
    <div ref={navigation.ref} aria-busy={navigation.pending}>
      <a className={layout["skip-link"]} href={asset(route + "#main")}>
        {t("skip")}
      </a>
      <SiteHeader />
      <main id="main">
        {route.startsWith("docs/") ? (
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
