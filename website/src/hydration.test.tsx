import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { App } from "./App";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { render } from "./prerender";

it.each(["zh", "en"] as const)(
  "hydrates preselected %s markup without a language flash",
  async (language) => {
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    const host = document.createElement("div");
    host.innerHTML = render("/", language);
    const heading = host.querySelector("h1")?.textContent;
    document.body.append(host);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          host,
          <LanguageProvider initialLanguage={language}>
            <App />
          </LanguageProvider>,
          { onRecoverableError },
        );
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(host.querySelector("h1")?.textContent).toBe(heading);
    } finally {
      await act(async () => root?.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  },
);

it.each(["zh", "en"] as const)(
  "hydrates the static %s blog body and switches languages",
  async (language) => {
    const host = document.createElement("div");
    host.id = "root";
    host.innerHTML = render("/", language, "blog/a-clear-agent-loop/");
    document.body.append(host);
    const errors = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          host,
          <LanguageProvider initialLanguage={language}>
            <App path="blog/a-clear-agent-loop/" />
          </LanguageProvider>,
          { onRecoverableError: errors },
        );
      });
      expect(errors).not.toHaveBeenCalled();
      expect(host.querySelector('[data-blog-body="en"]')?.textContent).toContain(
        "Start with one complete interaction",
      );
      expect(host.querySelector('[data-blog-body="zh"]')?.textContent).toContain(
        "从一次完整的交互开始",
      );
    } finally {
      await act(async () => root?.unmount());
      host.remove();
    }
  },
);
