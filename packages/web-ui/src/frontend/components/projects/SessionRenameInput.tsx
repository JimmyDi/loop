import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSessionRename } from "../../hooks/useSessionRename";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./SessionRenameInput.css";

export const SessionRenameInput = ({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose(): void;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const action = useSessionRename(id);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const save = async () => {
    if (saving.current || !draft.trim()) return;
    if (draft.trim() === title) return onClose();
    saving.current = true;
    const saved = await action.rename(draft);
    saving.current = false;
    if (saved) onClose();
    else input.current?.focus();
  };
  return (
    <div className="session-rename">
      <input
        ref={input}
        aria-label={t("sessionTitle")}
        aria-invalid={!draft.trim() || !!action.error}
        aria-busy={action.pending}
        value={draft}
        readOnly={action.pending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!saving.current) onClose();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape" && !saving.current) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <ErrorNotice error={action.error} />
    </div>
  );
};
