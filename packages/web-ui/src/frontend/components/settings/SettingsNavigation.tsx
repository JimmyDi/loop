import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { SettingsIcon } from "../ui/SettingsIcon";
import { settingsGroups } from "./settings-sections";
import type { SettingsSection } from "./settings-sections";
import "./SettingsNavigation.css";

export const SettingsNavigation = ({
  id,
  section,
  onSelect,
}: {
  id: string;
  section: SettingsSection;
  onSelect(section: SettingsSection): void;
}) => {
  const { t } = useTranslation();
  const tabs = useRef<Partial<Record<SettingsSection, HTMLButtonElement | null>>>({});
  return (
    <nav className="settings-navigation" aria-label={t("settingsSections")}>
      {settingsGroups.map((group) => (
        <div className="settings-navigation-group" key={group.label}>
          <h3 className="settings-navigation-heading" id={id + "-" + group.label + "-heading"}>
            {t(group.label)}
          </h3>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-labelledby={id + "-" + group.label + "-heading"}
            onKeyDown={(event) => {
              const items: readonly SettingsSection[] = group.items;
              const current = items.findIndex((item) => tabs.current[item] === event.target);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : event.key === "ArrowDown"
                      ? (current + 1) % items.length
                      : event.key === "ArrowUp"
                        ? (current + items.length - 1) % items.length
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              const target = items[next]!;
              onSelect(target);
              tabs.current[target]?.focus();
            }}
          >
            {group.items.map((item, index) => (
              <ActionButton
                key={item}
                className="settings-navigation-item ghost"
                role="tab"
                id={id + "-" + item + "-tab"}
                aria-selected={section === item}
                aria-controls={id + "-" + item + "-panel"}
                tabIndex={
                  section === item ||
                  (!group.items.some((value) => value === section) && index === 0)
                    ? 0
                    : -1
                }
                ref={(element) => {
                  tabs.current[item] = element;
                }}
                onClick={() => onSelect(item)}
              >
                {item === "general" ? (
                  <SettingsIcon />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {item === "models" ? (
                      <>
                        <ellipse cx="10" cy="5" rx="6" ry="3" />
                        <path d="M4 5v6c0 1.7 2.7 3 6 3m6-9v5M4 11v6c0 1.7 2.7 3 6 3" />
                        <circle cx="17" cy="17" r="3" />
                        <path d="M17 12v2m0 6v2m-5-5h2m6 0h2m-8.5-3.5 1.4 1.4m4.2 4.2 1.4 1.4m-7 0 1.4-1.4m4.2-4.2 1.4-1.4" />
                      </>
                    ) : item === "mcps" ? (
                      <path d="M9 7V2m6 5V2M6 7h12M7 7v5a5 5 0 0 0 10 0V7m-5 10v5" />
                    ) : item === "skills" ? (
                      <path d="M14 3H5v18h14V8l-5-5Z M14 3v5h5M8 12h8M8 16h6" />
                    ) : item === "appearance" ? (
                      <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                      </>
                    ) : (
                      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M3 4h18v4H3zM9 12h6" />
                    )}
                  </svg>
                )}
                {t(item === "skills" ? "skills.title" : item)}
              </ActionButton>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};
