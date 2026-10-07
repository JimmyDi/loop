import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSkills } from "../../hooks/useSkills";
import { useWorkspace } from "../../state/workspace-store";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ComposerSkillStatus } from "./ComposerSkillStatus";
import "./ComposerSkills.css";

export const ComposerSkills = ({
  sessionId,
  workspaceId,
  text,
  disabled,
  onText,
}: {
  sessionId: string;
  workspaceId: string;
  text: string;
  disabled: boolean;
  onText(text: string): void;
}) => {
  const { t } = useTranslation();
  const token = text.match(/(?:^|\s)\$([a-z0-9-]*)$/i);
  const api = useSkills(workspaceId, !!token && !disabled);
  const [dismissed, setDismissed] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(0);
  const available = api.query.data?.skills?.filter((skill) => skill.enabled && !skill.error) ?? [];
  const candidates = available.filter((skill) =>
    (skill.name + " " + skill.description).toLowerCase().includes(token?.[1]?.toLowerCase() ?? ""),
  );
  const loading = api.query.isPending || api.query.data?.discovering;
  const error = api.query.error ?? api.query.data?.error;
  const choose = (id: string, name: string) => {
    useWorkspace.getState().selectSkill(sessionId, { id, name });
    onText(text.replace(/\$[a-z0-9-]*$/i, ""));
    root.current
      ?.closest("form")
      ?.querySelector<HTMLElement>('[role="textbox"]')
      ?.focus({ preventScroll: true });
  };
  useEffect(() => {
    setHighlighted(0);
  }, [text]);
  useEffect(() => {
    if (!token || text === dismissed || disabled) return;
    const form = root.current?.closest("form");
    const handle = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('[role="textbox"], [role="listbox"]')
      )
        return;
      if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") setDismissed(text);
      else if (event.key === "Enter") {
        const skill = candidates[highlighted % candidates.length];
        if (skill) choose(skill.id, skill.name);
      } else
        setHighlighted((index) =>
          candidates.length
            ? (index + (event.key === "ArrowDown" ? 1 : -1) + candidates.length) % candidates.length
            : 0,
        );
    };
    form?.addEventListener("keydown", handle, true);
    return () => form?.removeEventListener("keydown", handle, true);
  });
  return (
    <div className="composer-skills" ref={root}>
      {token && text !== dismissed && !disabled && (
        <div
          role="listbox"
          aria-label={t("skills.select")}
          className="composer-skill-menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDismissed(text);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
              ];
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
              buttons[
                (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
              ]?.focus();
            }
          }}
        >
          <div className="composer-skill-menu-heading">{t("skills.title")}</div>
          {loading && !!candidates.length && <small role="status">{t("skills.discovering")}</small>}
          <ErrorNotice error={error} />
          {candidates.map((skill, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === highlighted}
              key={skill.id}
              title={
                skill.name +
                " · " +
                t("skills." + skill.scope) +
                "\n" +
                skill.description +
                (candidates.some((row) => row.id !== skill.id && row.name === skill.name)
                  ? "\n" + skill.path
                  : "")
              }
              onClick={() => choose(skill.id, skill.name)}
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
                <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z m-8 4.5 8 4.5 8-4.5M12 12v9m-8-9 8 4.5 8-4.5" />
              </svg>
              <strong>{skill.name}</strong>
              <span className="composer-skill-description">{skill.description}</span>
              <span className="composer-skill-source">{t("skills." + skill.scope)}</span>
            </button>
          ))}
          {!candidates.length && !error && (
            <ComposerSkillStatus
              state={
                loading
                  ? "loading"
                  : available.length
                    ? "noMatch"
                    : api.query.data?.skills.length
                      ? "unavailable"
                      : "empty"
              }
            />
          )}
          <div className="composer-skill-menu-footer">
            <kbd>Esc</kbd>
            <span>{t("skills.picker.dismiss")}</span>
          </div>
        </div>
      )}
    </div>
  );
};
