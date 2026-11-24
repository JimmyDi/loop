import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

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

export const AppShell = () => {
  const { t } = useTranslation();
  const { active, sidebar, toggleSidebar } = useWorkspace();
  const resize = useSidebarWidth();
  const settings = useSettings();

  const drawer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    const toggle = () => setSidebarCollapsed((value) => !value);
    window.addEventListener("loop:toggle-desktop-sidebar", toggle);
    return () => window.removeEventListener("loop:toggle-desktop-sidebar", toggle);
  }, []);

  useMobileDrawer(drawer, sidebar && !settings.section, toggleSidebar, content);
  useListEvents();

  return (
    <div
      className="app-shell"
      ref={viewport}
      data-sidebar={sidebar}
      data-sidebar-collapsed={sidebarCollapsed}
      style={{ "--sidebar-width": resize.width + "px" } as CSSProperties}
    >
      <button
        type="button"
        className="web-sidebar-toggle"
        aria-expanded={!sidebarCollapsed}
        aria-label={t(sidebarCollapsed ? "openSidebar" : "closeSidebar")}
        title={t(sidebarCollapsed ? "openSidebar" : "closeSidebar")}
        onClick={() => setSidebarCollapsed((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
        </svg>
      </button>
      <NavigationBar
        collapsed={sidebarCollapsed}
        settingsOpen={!!settings.section}
        onSettings={() => settings.open()}
      />
      <div className="app-shell-workspace">
        <div className="app-shell-home">
          <div className="sidebar-container" ref={drawer}>
            <div className="sidebar-content" inert={sidebarCollapsed}>
              <Sidebar />
            </div>
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
            aria-valuemin={240}
            aria-valuemax={420}
            tabIndex={0}
            onPointerDown={resize.onPointerDown}
            onPointerMove={resize.onPointerMove}
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
        {settings.section && (
          <Suspense
            fallback={
              <div className="settings-loading" role="status">
                {t("loading")}
              </div>
            }
          >
            <SettingsPanel initialSection={settings.section} onClose={settings.close} />
          </Suspense>
        )}
      </div>
    </div>
  );
};
