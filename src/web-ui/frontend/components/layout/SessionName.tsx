import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useSessionRename } from "../../hooks/useSessionRename";
import { useSessions } from "../../state/session-store";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./SessionName.css";

export const SessionName = ({ snapshot }: { snapshot: SessionSnapshot }) => {
  const { t } = useTranslation();
  const liveTitle = useSessions(
    (state) => state.views[snapshot.sessionId]?.snapshot?.state.title?.text,
  );
  const title = liveTitle ?? snapshot.state.title?.text ?? t("newSession");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);
  const restoreFocus = useRef(false);
  const hint = useId();
  const action = useSessionRename(snapshot);
  const disabled = snapshot.operation !== "idle" || snapshot.state.hasPendingSave || action.pending;

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  const confirm = async () => {
    if (saving.current || disabled || !draft.trim()) return;
    if (draft.trim() === title) {
      restoreFocus.current = true;
      setEditing(false);
      return;
    }
    saving.current = true;
    const saved = await action.rename(draft);
    saving.current = false;
    if (saved) {
      restoreFocus.current = true;
      setEditing(false);
    } else {
      input.current?.focus();
    }
  };

  return (
    <div className="session-name">
      {editing ? (
        <input
          ref={input}
          className="session-name-input"
          aria-label={t("sessionTitle")}
          aria-describedby={hint}
          aria-invalid={!draft.trim() || !!action.error}
          aria-busy={action.pending}
          value={draft}
          readOnly={action.pending}
          style={{
            width:
              Math.max(
                4,
                Array.from(draft).reduce(
                  (size, character) => size + (character.charCodeAt(0) > 255 ? 2 : 1),
                  0,
                ),
              ) +
              2 +
              "ch",
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!saving.current) setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter") {
              event.preventDefault();
              void confirm();
            } else if (event.key === "Escape" && !saving.current) {
              event.preventDefault();
              restoreFocus.current = true;
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          ref={button}
          className="session-name-button"
          type="button"
          disabled={disabled}
          title={t("editSessionName")}
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
        >
          {title}
        </button>
      )}
      <span id={hint} className="session-name-hint">
        {t("sessionNameEditHint")}
      </span>
      {editing && <ErrorNotice error={action.error} />}
    </div>
  );
};
