import { useRef } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useSidebarWidth } from "../../hooks/useSidebarWidth";
import { useMobileDrawer } from "../../hooks/useMobileDrawer";
import { useWorkspace } from "../../state/workspace-store";
import { ChatWorkspace } from "../chat/ChatWorkspace";
import { Sidebar } from "./Sidebar";
import { Welcome } from "./Welcome";
import "./AppShell.css";

export const AppShell = () => {
  const { t } = useTranslation();
  const { active, sidebar, toggleSidebar } = useWorkspace();
  const resize = useSidebarWidth();
  const drawer = useRef<HTMLDivElement>(null);

  useMobileDrawer(drawer, sidebar, toggleSidebar);

  return (
    <div
      className="app-shell"
      data-sidebar={sidebar}
      style={{ "--sidebar-width": resize.width + "px" } as CSSProperties}
    >
      <div className="sidebar-container" ref={drawer}>
        <Sidebar />
      </div>
      {sidebar && (
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
        onPointerMove={resize.onPointerMove}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            resize.setWidth(resize.width + (event.key === "ArrowRight" ? 10 : -10));
          }
        }}
      />
      {active ? <ChatWorkspace key={active} id={active} /> : <Welcome />}
    </div>
  );
};
