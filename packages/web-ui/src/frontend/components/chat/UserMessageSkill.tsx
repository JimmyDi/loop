import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type { LoadedSkill, SkillCatalog } from "../../../shared/skills";
import { api } from "../../lib/api";
import { skillQueryPath } from "../../hooks/useSkills";
import "./UserMessageSkill.css";

export const UserMessageSkill = ({
  skill,
  workspaceId,
}: {
  skill: Pick<LoadedSkill, "id" | "name" | "description">;
  workspaceId?: string;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [legacy, setLegacy] = useState<{ description?: string }>();
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const description = skill.description ?? legacy?.description;

  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open || skill.description !== undefined || legacy || !workspaceId) return;
    const abort = new AbortController();
    void api<SkillCatalog>("/settings/skills" + skillQueryPath(workspaceId), {
      signal: abort.signal,
    })
      .then((catalog) => {
        if (!abort.signal.aborted)
          setLegacy({
            description: catalog.skills.find((row) => row.id === skill.id)?.description,
          });
      })
      .catch(() => {
        if (!abort.signal.aborted) setLegacy({});
      });
    return () => abort.abort();
  }, [open, skill.id, skill.description, legacy, workspaceId]);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const bounds = tooltip.current.getBoundingClientRect();
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12));
    const below = anchor.bottom + 8;
    const top =
      below + bounds.height <= window.innerHeight - 12
        ? below
        : Math.max(12, anchor.top - bounds.height - 8);
    setPosition({ left, top, ready: true });
  }, [open, description, legacy]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.type === "scroll" && tooltip.current?.contains(event.target as Node)) return;
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      clearTimeout(timer.current);
      setOpen(false);
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="user-message-skill"
        ref={trigger}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={show}
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
        <span>{skill.name}</span>
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="user-skill-tooltip"
            ref={tooltip}
            style={{
              left: position.left,
              top: position.top,
              visibility: position.ready ? "visible" : "hidden",
            }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {description ||
              t(
                !legacy && workspaceId && skill.description === undefined
                  ? "loading"
                  : "skills.descriptionUnavailable",
              )}
          </div>,
          document.body,
        )}
    </>
  );
};
