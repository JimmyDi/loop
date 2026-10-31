import { useEffect, useRef, useState } from "react";

import { asset } from "../assets";
import { normalizeRoute, resolveContentRoute } from "../content-routes";

export const useContentNavigation = (initialRoute: string) => {
  const ref = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState({ route: initialRoute, html: "" });
  const [pending, setPending] = useState(false);
  useEffect(() => setContent({ route: initialRoute, html: "" }), [initialRoute]);
  useEffect(() => {
    const base = document.querySelector("base");
    if (base) base.href = document.baseURI;
    const home = new URL(asset(""), location.href).pathname;
    const canNavigate = (path: string) => {
      const target = resolveContentRoute(path);
      return (
        path === home ||
        (target.kind === "docs" ? !!target.page : target.kind === "changelog" && !!target.release)
      );
    };
    let controller: AbortController | undefined;
    const navigate = async (url: URL, push: boolean) => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setPending(true);
      try {
        const route = normalizeRoute(url.pathname);
        const target = resolveContentRoute(route);
        let html = target.page?.html || (target.detail ? target.release?.html : "") || "";
        if (!html && (target.page || target.detail)) {
          const response = await fetch(url.href, { signal: request.signal });
          if (!response.ok) throw new Error("Content request failed.");
          const document = new DOMParser().parseFromString(await response.text(), "text/html");
          const article = document.querySelector("[data-content-article]");
          const baseUrl = new URL(
            document.querySelector("base")?.getAttribute("href") || "./",
            url,
          );
          for (const link of article?.querySelectorAll("a[href]") ?? []) {
            link.setAttribute("href", new URL(link.getAttribute("href")!, baseUrl).href);
          }
          html = article?.innerHTML ?? "";
          if (!html) throw new Error("Content article is missing.");
        }
        if (request.signal.aborted) return;
        if (push) history.pushState(null, "", url.href);
        setContent({ route, html });
        requestAnimationFrame(() => {
          const target = url.hash
            ? document.getElementById(decodeURIComponent(url.hash.slice(1)))
            : null;
          if (target) target.scrollIntoView();
          else window.scrollTo({ top: 0, behavior: "instant" });
        });
      } catch {
        if (!request.signal.aborted) location.assign(url.href);
      } finally {
        if (!request.signal.aborted) setPending(false);
      }
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        url.pathname === location.pathname ||
        !canNavigate(url.pathname)
      )
        return;
      event.preventDefault();
      void navigate(url, true);
    };
    const pop = () => {
      if (canNavigate(location.pathname)) void navigate(new URL(location.href), false);
      else location.reload();
    };
    const element = ref.current;
    element?.addEventListener("click", click);
    window.addEventListener("popstate", pop);
    return () => {
      controller?.abort();
      element?.removeEventListener("click", click);
      window.removeEventListener("popstate", pop);
    };
  }, [initialRoute]);
  return { ref, pending, ...content };
};
