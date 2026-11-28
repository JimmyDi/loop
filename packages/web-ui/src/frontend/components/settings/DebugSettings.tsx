import { useTranslation } from "react-i18next";

import { useDebug } from "../../state/debug-store";
import "./DebugSettings.css";

export const DebugSettings = () => {
  const { t } = useTranslation();
  const { openUiDevtools, setOpenUiDevtools } = useDebug();

  return (
    <>
      <h3 className="settings-section-title debug-settings-title">{t("debug")}</h3>
      <label className="debug-settings-option">
        <span>{t("openUiDevtools")}</span>
        <input
          type="checkbox"
          role="switch"
          checked={openUiDevtools}
          onChange={(event) => setOpenUiDevtools(event.currentTarget.checked)}
        />
      </label>
    </>
  );
};
