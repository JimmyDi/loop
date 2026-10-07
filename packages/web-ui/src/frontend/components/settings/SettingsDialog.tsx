import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { Modal } from "../ui/Modal";
import { GeneralSettings } from "./GeneralSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { ModelsSettings } from "./ModelsSettings";
import { McpSettings } from "./McpSettings";
import { SkillsSettings } from "./SkillsSettings";
import { ArchivedChats } from "./ArchivedChats";
import { SettingsNavigation } from "./SettingsNavigation";
import { settingsGroups } from "./settings-sections";
import type { SettingsSection } from "./settings-sections";
import "./SettingsDialog.css";

export const SettingsDialog = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const id = useId();
  const [section, setSection] = useState<SettingsSection>("general");
  return createPortal(
    <Modal
      title={t("settings")}
      className="settings-dialog"
      closeLabel={t("close")}
      onClose={onClose}
    >
      <div className="settings-dialog-body">
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
                ) : item === "appearance" ? (
                  <AppearanceSettings />
                ) : item === "mcps" ? (
                  <McpSettings />
                ) : item === "skills" ? (
                  <SkillsSettings onUse={onClose} />
                ) : (
                  <ArchivedChats onOpen={onClose} />
                ))}
            </section>
          ))}
      </div>
    </Modal>,
    document.body,
  );
};
