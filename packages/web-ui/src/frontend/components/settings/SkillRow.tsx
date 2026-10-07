import { useTranslation } from "react-i18next";

import type { SkillSummary } from "../../../shared/skills";
import "./SkillRow.css";

export const SkillRow = ({
  skill,
  pending,
  onOpen,
  onToggle,
}: {
  skill: SkillSummary;
  pending: boolean;
  onOpen(): void;
  onToggle(): void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="skill-row plugin-row">
      <button
        type="button"
        className="skill-row-info plugin-row-identity"
        aria-label={t("skills.details", { name: skill.name })}
        onClick={onOpen}
      >
        <span className="plugin-row-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 3H5v18h14V8l-5-5Z M14 3v5h5M8 12h8M8 16h6" />
          </svg>
        </span>
        <span className="skill-row-text">
          <strong title={skill.name}>{skill.name}</strong>
          <span className="skill-row-description" title={skill.description || skill.error}>
            {skill.description || skill.error}
          </span>
          {skill.error && <span className="plugin-row-meta">{t("skills.attention")}</span>}
        </span>
      </button>
      <div className="plugin-row-actions">
        <button
          type="button"
          role="switch"
          aria-checked={skill.enabled}
          aria-label={t("skills.enable", { name: skill.name })}
          disabled={pending || !!skill.error}
          onClick={onToggle}
          className="plugin-switch"
        >
          <span />
        </button>
      </div>
    </div>
  );
};
