import { useId, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";

import type { SessionSummary } from "../../../shared/protocol";
import {
  isSidebarSectionAtTop,
  preserveSidebarScroll,
  scrollSidebarSection,
} from "../../lib/scroll-sidebar-section";
import { SessionList } from "./SessionList";
import "./SidebarSessionSection.css";

export const SidebarSessionSection = ({
  title,
  kind,
  sessions,
  children,
}: {
  title: string;
  kind: "pinned" | "chats";
  sessions: SessionSummary[];
  children?: ReactNode;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  const activateSection = (heading: HTMLElement) => {
    if (!expanded) {
      setExpanded(true);
      return;
    }
    const target =
      kind === "pinned" ? ".pinned-sessions .session-item" : ".standalone-chats .session-item";
    if (isSidebarSectionAtTop(heading, target)) {
      preserveSidebarScroll(heading, () => flushSync(() => setExpanded(false)));
      return;
    }
    scrollSidebarSection(heading, target);
  };

  if (!sessions.length) return children;
  return (
    <section
      className={kind === "pinned" ? "pinned-sessions" : "standalone-chats"}
      aria-labelledby={id}
    >
      <h2 className="sidebar-session-heading" id={id}>
        <button
          type="button"
          className="sidebar-projects-label"
          aria-expanded={expanded}
          aria-controls={id + "-list"}
          onClick={(event) => activateSection(event.currentTarget.parentElement!)}
        >
          {title}
        </button>
        <button
          type="button"
          className="sidebar-projects-toggle"
          aria-label={t(kind === "pinned" ? "togglePinned" : "toggleChats")}
          aria-expanded={expanded}
          aria-controls={id + "-list"}
          onClick={(event) => activateSection(event.currentTarget.parentElement!)}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d={expanded ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4"} />
          </svg>
        </button>
      </h2>
      <div id={id + "-list"} className="sidebar-session-list" hidden={!expanded}>
        <SessionList sessions={sessions} pinned={kind === "pinned"} />
      </div>
      {children}
    </section>
  );
};
