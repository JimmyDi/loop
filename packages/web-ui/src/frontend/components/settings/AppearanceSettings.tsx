import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../state/theme-store";
import "./AppearanceSettings.css";

const themes = ["system", "light", "dark"] as const;

export const AppearanceSettings = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <>
      <h3 className="appearance-settings-title">{t("appearance")}</h3>
      <fieldset className="appearance-settings">
        <legend>{t("theme")}</legend>
        <div className="appearance-options">
          {themes.map((value) => (
            <label className="appearance-option" data-theme-preview={value} key={value}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
              />
              <span className="appearance-card">
                <span className="appearance-preview" aria-hidden="true">
                  {(value === "system" ? ["light", "dark"] : [value]).map((scheme) => (
                    <span className="appearance-preview-scene" data-scheme={scheme} key={scheme}>
                      <span className="appearance-preview-heading" />
                      <span className="appearance-preview-sheet">
                        <span className="appearance-preview-row" />
                        <span className="appearance-preview-row" />
                        <span className="appearance-preview-row" />
                      </span>
                    </span>
                  ))}
                </span>
                <span className="appearance-label">{t(value)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
};
