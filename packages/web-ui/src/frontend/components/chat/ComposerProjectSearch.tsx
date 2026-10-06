import { useTranslation } from "react-i18next";

import "./ComposerProjectSearch.css";

export const ComposerProjectSearch = ({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}) => {
  const { t } = useTranslation();
  return (
    <label className="composer-project-search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="7" />
        <path d="m16 16 5 5" />
      </svg>
      <input
        type="search"
        aria-label={t("searchProjects")}
        placeholder={t("searchProjects")}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};
