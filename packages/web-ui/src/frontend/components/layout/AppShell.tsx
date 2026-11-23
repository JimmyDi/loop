import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useUnreadSessions } from "../../hooks/useUnreadSessions";
import { useSidebarWidth } from "../../hooks/useSidebarWidth";
import { useMobileDrawer } from "../../hooks/useMobileDrawer";
import { useListEvents } from "../../hooks/useListEvents";
import { useVisualViewport } from "../../hooks/useVisualViewport";
import { useWorkspace } from "../../state/workspace-store";
import { ChatWorkspace } from "../chat/ChatWorkspace";
import { Sidebar } from "./Sidebar";
import { NavigationBar } from "./NavigationBar";
import { useSettings } from "../../state/settings-store";
import { PwaStatus } from "../pwa/PwaStatus";
import "./AppShell.css";

const SettingsPanel = lazy(() =>
  import("../settings/SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);
const EchoWorkspace = lazy(() =>
  import("../echo/EchoWorkspace").then((module) => ({ default: module.EchoWorkspace })),
);

type AppPage = "home" | "echo" | "settings";

const pageFromPath = (path: string): AppPage =>
  path === "/echo" ? "echo" : path === "/settings" ? "settings" : "home";

const pagePath = (page: AppPage): string => (page === "home" ? "/" : "/" + page);

export const AppShell = () => {
  const { t } = useTranslation();
  const { active, sidebar, toggleSidebar } = useWorkspace();
  const resize = useSidebarWidth();
  const settings = useSettings();
  const [page, setPage] = useState<AppPage>(() =>
    typeof window === "undefined" ? "home" : pageFromPath(window.location.pathname),
  );
  const [ready, setReady] = useState(false);
  const previousPage = useRef<AppPage>("home");
  const echoOpen = page === "echo" || (page === "settings" && previousPage.current === "echo");
  const unread = useUnreadSessions();
  const drawer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();

  useMobileDrawer(drawer, sidebar && !settings.section, toggleSidebar, content);
  useListEvents();

  const navigate = (next: AppPage) => {
    if (next === "settings" && page !== "settings") previousPage.current = page;
    if (next === "settings") settings.open();
    else settings.close();
    setPage(next);
    if (window.location.pathname !== pagePath(next))
      window.history.pushState(null, "", pagePath(next));
  };

  useEffect(() => {
    if (page === "settings") settings.open();
    else settings.close();
    const restore = () => {
      const next = pageFromPath(window.location.pathname);
      if (next === "settings") settings.open();
      else settings.close();
      setPage(next);
    };
    window.addEventListener("popstate", restore);
    setReady(true);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (settings.section && page !== "settings") navigate("settings");
    else if (!settings.section && page === "settings") navigate(previousPage.current);
  }, [ready, settings.section, page]);

  return (
    <div
      className="app-shell"
      ref={viewport}
      data-sidebar={sidebar}
      style={{ "--sidebar-width": resize.width + "px" } as CSSProperties}
    >
      <NavigationBar
        settingsOpen={!!settings.section}
        unread={unread}
        onHome={() => {
          navigate("home");
        }}
        echoOpen={echoOpen}
        onEcho={() => {
          navigate("echo");
        }}
        onSettings={() => navigate("settings")}
      />
      <div className="app-shell-workspace">
        <div
          className="app-shell-home"
          hidden={!!settings.section || echoOpen}
          inert={!!settings.section || echoOpen}
        >
          <div className="sidebar-container" ref={drawer}>
            <Sidebar />
          </div>
          {sidebar && !settings.section && (
            <button
              type="button"
              className="sidebar-scrim"
              aria-label={t("closeSidebar")}
              onClick={() => toggleSidebar(false)}
            />
          )}
          <div
            className="sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("resize")}
            aria-valuenow={resize.width}
            aria-valuemin={260}
            aria-valuemax={420}
            tabIndex={0}
            onPointerDown={resize.onPointerDown}
            onPointerMove={(event) =>
              resize.onPointerMove(
                event,
                event.currentTarget.parentElement!.getBoundingClientRect().left,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                resize.setWidth(resize.width + (event.key === "ArrowRight" ? 10 : -10));
              }
            }}
          />
          <div className="app-shell-content" ref={content}>
            <PwaStatus />
            <ChatWorkspace id={active?.id} />
          </div>
        </div>
        {echoOpen && (
          <div hidden={!!settings.section} inert={!!settings.section} style={{ height: "100%" }}>
            <Suspense
              fallback={
                <div className="settings-loading" role="status">
                  {t("loading")}
                </div>
              }
            >
              <EchoWorkspace />
            </Suspense>
          </div>
        )}
        {settings.section && (
          <Suspense
            fallback={
              <div className="settings-loading" role="status">
                {t("loading")}
              </div>
            }
          >
            <SettingsPanel
              initialSection={settings.section}
              onClose={() => navigate(previousPage.current)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};
