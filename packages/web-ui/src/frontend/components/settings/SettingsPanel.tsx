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
import { Modal } from "../ui/Modal";
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
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <Modal
      title={t("settings")}
      closeLabel={t("close")}
      onClose={onClose}
      className="settings-panel"
    >
      <div className="settings-panel-body" ref={panel}>
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
    </Modal>
  );
};
