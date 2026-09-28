import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { Modal } from "../ui/Modal";
import { SettingsIcon } from "../ui/SettingsIcon";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { ModelsSettings } from "./ModelsSettings";
import "./SettingsDialog.css";

const sections = ["general", "models", "appearance"] as const;

export const SettingsDialog = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const id = useId();
  const [section, setSection] = useState<(typeof sections)[number]>("general");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  return createPortal(
    <Modal
      title={t("settings")}
      className="settings-dialog"
      closeLabel={t("close")}
      onClose={onClose}
    >
      <div className="settings-dialog-body">
        <nav className="settings-navigation" aria-label={t("settingsSections")}>
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("settingsSections")}
            onKeyDown={(event) => {
              const current = sections.indexOf(section);
              let next: number;

              switch (event.key) {
                case "ArrowDown":
                  next = (current + 1) % sections.length;
                  break;
                case "ArrowUp":
                  next = (current + sections.length - 1) % sections.length;
                  break;
                case "Home":
                  next = 0;
                  break;
                case "End":
                  next = sections.length - 1;
                  break;
                default:
                  return;
              }

              event.preventDefault();
              setSection(sections[next]!);
              tabs.current[next]?.focus();
            }}
          >
            {sections.map((item, index) => (
              <ActionButton
                key={item}
                className="settings-navigation-item ghost"
                role="tab"
                id={id + "-" + item + "-tab"}
                aria-selected={section === item}
                aria-controls={id + "-" + item + "-panel"}
                tabIndex={section === item ? 0 : -1}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                onClick={() => setSection(item)}
              >
                {item === "general" ? (
                  <SettingsIcon />
                ) : item === "models" ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <ellipse cx="10" cy="5" rx="6" ry="3" />
                    <path d="M4 5v6c0 1.7 2.7 3 6 3m6-9v5M4 11v6c0 1.7 2.7 3 6 3" />
                    <circle cx="17" cy="17" r="3" />
                    <path d="M17 12v2m0 6v2m-5-5h2m6 0h2m-8.5-3.5 1.4 1.4m4.2 4.2 1.4 1.4m-7 0 1.4-1.4m4.2-4.2 1.4-1.4" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                  </svg>
                )}
                {t(item)}
              </ActionButton>
            ))}
          </div>
        </nav>
        {sections.map((item) => (
          <section
            key={item}
            className="settings-content"
            role="tabpanel"
            id={id + "-" + item + "-panel"}
            aria-labelledby={id + "-" + item + "-tab"}
            hidden={section !== item}
          >
            {section === item &&
              (item === "general" ? (
                <GeneralSettings />
              ) : item === "models" ? (
                <ModelsSettings />
              ) : (
                <AppearanceSettings />
              ))}
          </section>
        ))}
      </div>
    </Modal>,
    document.body,
  );
};
