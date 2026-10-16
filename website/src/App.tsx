import { Capabilities } from "./components/Capabilities";
import { Hero } from "./components/Hero";
import { Interfaces } from "./components/Interfaces";
import layout from "./components/Layout.module.css";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { useLanguage } from "./i18n/useLanguage";

export const App = () => {
  const { t } = useLanguage();
  return (
    <>
      <a className={layout["skip-link"]} href="#main">
        {t("skip")}
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Capabilities />
        <Interfaces />
      </main>
      <SiteFooter />
    </>
  );
};
