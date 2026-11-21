import { lazy, Suspense, useRef } from "react";
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

export const AppShell = () => {
  const { t } = useTranslation();
  const { active, sidebar, toggleSidebar } = useWorkspace();
  const resize = useSidebarWidth();
  const settings = useSettings();
  const unread = useUnreadSessions();
  const drawer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport();

  useMobileDrawer(drawer, sidebar && !settings.section, toggleSidebar, content);
  useListEvents();

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
        onHome={settings.close}
        onSettings={() => settings.open()}
      />
      <div className="app-shell-workspace">
        <div className="app-shell-home" hidden={!!settings.section} inert={!!settings.section}>
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
