import { useId } from "react";
import type { InputHTMLAttributes } from "react";

import "./SettingsField.css";

export const SettingsField = ({
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) => {
  const id = useId();

  return (
    <label className="settings-field">
      <span>{label}</span>
      <input {...input} aria-describedby={hint ? id : undefined} />
      {hint && <small id={id}>{hint}</small>}
    </label>
  );
};
