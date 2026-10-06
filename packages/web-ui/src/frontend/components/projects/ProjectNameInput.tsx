import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import "./ProjectNameInput.css";

export const ProjectNameInput = ({
  ref,
  value,
  disabled,
  onChange,
}: {
  ref?: Ref<HTMLInputElement>;
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}) => {
  const { t } = useTranslation();

  return (
    <input
      ref={ref}
      className="create-project-name"
      aria-label={t("projectName")}
      placeholder={t("projectName")}
      value={value}
      disabled={disabled}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
    />
  );
};
