import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";
import "./global.css";

const root = document.getElementById("root");
const initialLanguage =
  root?.dataset.language === "en" ? "en" : root?.dataset.language === "zh" ? "zh" : undefined;
const page = (
  <LanguageProvider initialLanguage={initialLanguage}>
    <App />
  </LanguageProvider>
);
if (root) {
  if (root.querySelector("main")) {
    hydrateRoot(root, page);
  } else {
    createRoot(root).render(page);
  }
}
