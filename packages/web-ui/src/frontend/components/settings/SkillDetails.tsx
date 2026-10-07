import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { SkillJob, SkillSummary } from "../../../shared/skills";
import type { useSkills } from "../../hooks/useSkills";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { MarkdownText } from "../chat/MarkdownText";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { Modal } from "../ui/Modal";
import "./SkillDetails.css";

export const SkillDetails = ({
  skill,
  api,
  onClose,
  onUpdate,
  onUse,
}: {
  skill: SkillSummary & { content: string; files?: string[] };
  api: ReturnType<typeof useSkills>;
  onClose(): void;
  onUpdate(job: SkillJob): void;
  onUse?(): void;
}) => {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const [enabled, setEnabled] = useState(skill.enabled);
  const [confirm, setConfirm] = useState(false);
  return createPortal(
    <Modal
      title={skill.name}
      className="skill-details-dialog"
      closeDisabled={action.pending}
      onClose={onClose}
    >
      <header className="skill-details-header">
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
        <div className="skill-details-controls">
          <button
            type="button"
            role="switch"
            className="plugin-switch"
            aria-checked={enabled}
            aria-label={t("skills.enable", { name: skill.name })}
            disabled={action.pending || !!skill.error}
            onClick={() =>
              void action.run(async () => {
                await api.toggle(skill.id, !enabled);
                setEnabled(!enabled);
              })
            }
          >
            <span />
          </button>
          <ActionButton
            className="icon ghost"
            aria-label={t("close")}
            disabled={action.pending}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </ActionButton>
        </div>
      </header>
      <div className="skill-details-summary">
        <h3>{skill.name}</h3>
        <p>{skill.description}</p>
      </div>
      <div className="skill-details-content" tabIndex={0} aria-label={t("skills.instructions")}>
        {skill.error ? <ErrorNotice error={skill.error} /> : <MarkdownText text={skill.content} />}
        <details className="skill-details-source">
          <summary>{t("skills.source")}</summary>
          <p>
            {t("skills." + skill.scope)} · {skill.source.kind}
          </p>
          <code>{skill.path}</code>
          {skill.source.location && (
            <p>
              {skill.source.location} {skill.source.revision?.slice(0, 12)}
            </p>
          )}
          {!!skill.files?.length && (
            <>
              <p>
                {t("skills.resources")} ({skill.files.length})
              </p>
              <pre>{skill.files.join("\n")}</pre>
            </>
          )}
        </details>
      </div>
      <ErrorNotice error={action.error} />
      {confirm ? (
        <div className="skill-remove-confirm">
          <p>{t("skills.confirm")}</p>
          <div className="skill-details-actions">
            <ActionButton
              className="skill-uninstall"
              disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  await api.remove(skill.id);
                  onClose();
                })
              }
            >
              {t("skills.uninstall")}
            </ActionButton>
            <ActionButton disabled={action.pending} onClick={() => setConfirm(false)}>
              {t("cancel")}
            </ActionButton>
          </div>
        </div>
      ) : (
        <footer className="skill-details-actions">
          {skill.managed ? (
            <ActionButton
              className="skill-uninstall"
              disabled={action.pending}
              onClick={() => setConfirm(true)}
            >
              {t("skills.uninstall")}
            </ActionButton>
          ) : (
            <small>{t("skills.external")}</small>
          )}
          <div className="skill-details-primary">
            {skill.managed && skill.source.kind === "github" && (
              <ActionButton
                disabled={action.pending}
                onClick={() => void action.run(async () => onUpdate(await api.update(skill.id)))}
              >
                {t("skills.update")}
              </ActionButton>
            )}
            {onUse && (
              <ActionButton
                className="primary"
                disabled={action.pending || !enabled || !!skill.error}
                onClick={onUse}
              >
                {t("skills.use")}
              </ActionButton>
            )}
          </div>
        </footer>
      )}
    </Modal>,
    document.body,
  );
};
