import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import "./SkillProjectMenu.css";

export const SkillProjectMenu = ({
  projects,
  selected,
  disabled,
  onSelect,
}: {
  projects: Pick<Project, "id" | "name">[];
  selected: string;
  disabled: boolean;
  onSelect(id: string): void;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [firstItem, setFirstItem] = useState(0);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [open]);
  return (
    <div
      className="skill-project-menu"
      ref={root}
      onKeyDown={(event) => {
        if (disabled) return;
        if (open && (event.key === "Escape" || event.key === "Tab")) {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
          trigger.current?.focus({ preventScroll: true });
          setOpen(false);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        if (!open) {
          setFirstItem(event.key === "ArrowUp" || event.key === "End" ? projects.length - 1 : 0);
          setOpen(true);
          return;
        }
        const options = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
        ];
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        options[next]?.focus({ preventScroll: true });
      }}
    >
      <button
        type="button"
        className="skill-scope-more"
        ref={trigger}
        aria-label={t("skills.moreProjects")}
        title={t("skills.moreProjects")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        data-selected={projects.some((project) => project.id === selected)}
        onClick={() => {
          setFirstItem(0);
          setOpen((value) => !value);
        }}
      >
        …
      </button>
      {open && (
        <div
          className="skill-project-options"
          role="menu"
          aria-label={t("skills.moreProjects")}
          id={id}
        >
          {projects.map((project, index) => (
            <button
              type="button"
              role="menuitemradio"
              key={project.id}
              title={project.name}
              aria-checked={project.id === selected}
              autoFocus={index === firstItem}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
                onSelect(project.id);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z" />
              </svg>
              <span>{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
