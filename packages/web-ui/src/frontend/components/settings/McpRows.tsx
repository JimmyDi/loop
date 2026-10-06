import { useTranslation } from "react-i18next";

import type { McpValue } from "../../../shared/mcp";
import { ActionButton } from "../ui/ActionButton";
import "./McpRows.css";

export const McpRows = ({
  label,
  rows,
  onChange,
  pair = false,
  secret = false,
  valueLabel,
}: {
  label: string;
  rows: McpValue[];
  onChange(rows: McpValue[]): void;
  pair?: boolean;
  secret?: boolean;
  valueLabel?: string;
}) => {
  const { t } = useTranslation();
  const displayedRows = rows.length ? rows : [{ key: "", value: "" }];
  const update = (index: number, changes: Partial<McpValue>) =>
    onChange(
      displayedRows.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    );
  return (
    <div className="mcp-rows" role="group" aria-label={label}>
      <h4>{label}</h4>
      {displayedRows.map((row, index) => (
        <div className="mcp-input-row" key={index}>
          {pair && (
            <input
              aria-label={label + " " + t("mcp.key") + " " + (index + 1)}
              placeholder={t("mcp.key")}
              required={Boolean(row.value || row.saved)}
              value={row.key}
              onChange={(event) => update(index, { key: event.target.value, saved: false })}
            />
          )}
          <input
            aria-label={label + " " + (valueLabel ?? t("mcp.value")) + " " + (index + 1)}
            placeholder={row.saved ? t("mcp.savedValue") : (valueLabel ?? t("mcp.value"))}
            type={secret ? "password" : "text"}
            autoComplete="off"
            value={row.value}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <ActionButton
            className="ghost icon"
            aria-label={t("mcp.removeRow", { label, index: index + 1 })}
            onClick={() => onChange(rows.filter((_, position) => position !== index))}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
            </svg>
          </ActionButton>
        </div>
      ))}
      <ActionButton
        className="ghost mcp-add-row"
        onClick={() => onChange([...displayedRows, { key: "", value: "" }])}
      >
        ＋ {t("mcp.addRow", { label })}
      </ActionButton>
    </div>
  );
};
