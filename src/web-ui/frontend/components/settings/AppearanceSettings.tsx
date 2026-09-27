import { useId } from "react";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../state/theme-store";
import "./AppearanceSettings.css";

const themes = ["light", "dark", "system"] as const;

export const AppearanceSettings = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <fieldset className="appearance-settings">
      <legend>{t("appearance")}</legend>
      <div className="appearance-options">
        {themes.map((value) => (
          <label className="appearance-option" key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={theme === value}
              onChange={() => setTheme(value)}
            />
            <span className="appearance-card">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {value === "light" && (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                  </>
                )}
                {value === "dark" && <path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />}
                {value === "system" && (
                  <>
                    <rect x="4" y="4" width="16" height="12" rx="3" />
                    <path d="M9 20h6m-3-4v4" />
                  </>
                )}
              </svg>
              {t(value)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
