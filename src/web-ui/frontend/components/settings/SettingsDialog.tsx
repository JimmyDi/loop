import { useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import { Modal } from "../ui/Modal";
import { SettingsIcon } from "../ui/SettingsIcon";
import { GeneralSettings } from "./GeneralSettings";
import "./SettingsDialog.css";

export const SettingsDialog = ({ onClose }: { onClose(): void }) => {
  const { t } = useTranslation();
  const id = useId();

  return createPortal(
    <Modal title="Settings" className="settings-dialog" closeLabel={t("close")} onClose={onClose}>
      <div className="settings-dialog-body">
        <nav className="settings-navigation" aria-label={t("settingsSections")}>
          <div role="tablist" aria-orientation="vertical" aria-label={t("settingsSections")}>
            <ActionButton
              className="settings-navigation-item ghost"
              role="tab"
              id={id + "-general-tab"}
              aria-selected="true"
              aria-controls={id + "-general-panel"}
            >
              <SettingsIcon />
              General
            </ActionButton>
          </div>
        </nav>
        <section
          className="settings-content"
          role="tabpanel"
          id={id + "-general-panel"}
          aria-labelledby={id + "-general-tab"}
        >
          <GeneralSettings />
        </section>
      </div>
    </Modal>,
    document.body,
  );
};
