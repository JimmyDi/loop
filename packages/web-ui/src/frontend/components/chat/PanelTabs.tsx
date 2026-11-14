import { useRef } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import "./PanelTabs.css";

export const PanelTabs = <T,>({
  tabs,
  active,
  select,
  close,
  renderIcon,
}: {
  tabs: { id: string; title: string; content: T }[];
  active?: string;
  select(id: string): void;
  close(id: string): void;
  renderIcon?(content: T): ReactNode;
}) => {
  const { t } = useTranslation();
  const list = useRef<HTMLDivElement>(null);
  return (
    <div role="tablist" aria-label={t("panelTabs")} ref={list}>
      {tabs.map((tab, index) => (
        <div className="workspace-panel-tab" data-active={tab.id === active} key={tab.id}>
          <div
            role="tab"
            id={"panel-tab-" + index}
            aria-controls={"panel-content-" + index}
            aria-selected={tab.id === active}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                select(tab.id);
                return;
              }
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % tabs.length
                  : event.key === "ArrowLeft"
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : undefined;
              if (next !== undefined) {
                event.preventDefault();
                select(tabs[next]!.id);
                list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
              }
            }}
          >
            {renderIcon?.(tab.content)}
            <span>{tab.title}</span>
          </div>
          <button
            type="button"
            className="workspace-panel-tab-close"
            aria-label={t("closePanelTab", { title: tab.title })}
            onClick={() => close(tab.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
