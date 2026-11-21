import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { ModelsSettings } from "./ModelsSettings";
import { McpSettings } from "./McpSettings";
import { SkillsSettings } from "./SkillsSettings";
import { ArchivedChats } from "./ArchivedChats";
import { RemoteAccessPanel } from "./RemoteAccessPanel";
import { VoiceSettings } from "./VoiceSettings";
import { SettingsNavigation } from "./SettingsNavigation";
import { settingsGroups } from "./settings-sections";
import type { SettingsSection } from "./settings-sections";
import "./SettingsPanel.css";

export const SettingsPanel = ({
  onClose,
  initialSection = "general",
}: {
  onClose(): void;
  initialSection?: SettingsSection;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      ref={panel}
      className="settings-panel"
      aria-label={t("settings")}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          !(event.target as HTMLElement).closest("dialog")
        ) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="settings-panel-header">
        <h2>{t("settings")}</h2>
      </header>
      <div className="settings-panel-body">
        <SettingsNavigation id={id} section={section} onSelect={setSection} />
        {settingsGroups
          .flatMap((group) => [...group.items])
          .map((item) => (
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
                ) : item === "voice" ? (
                  <VoiceSettings />
                ) : item === "appearance" ? (
                  <AppearanceSettings />
                ) : item === "mcps" ? (
                  <McpSettings />
                ) : item === "skills" ? (
                  <SkillsSettings onUse={onClose} />
                ) : item === "remoteAccess" ? (
                  <RemoteAccessPanel />
                ) : (
                  <ArchivedChats onOpen={onClose} />
                ))}
            </section>
          ))}
      </div>
    </section>
  );
};
