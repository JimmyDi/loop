import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { IMAGE_TYPES, MAX_IMAGES } from "../../../shared/prompt-images";
import { MAX_TEXT_FILES, TEXT_FILE_ACCEPT } from "../../../shared/prompt-files";
import { useComposerMenu } from "../../hooks/useComposerMenu";
import { ActionButton } from "../ui/ActionButton";
import "./ComposerAddMenu.css";

export const ComposerAddMenu = ({
  disabled,
  imageCount,
  fileCount,
  add,
}: {
  disabled: boolean;
  imageCount: number;
  fileCount: number;
  add(files: File[]): void;
}) => {
  const { t } = useTranslation();
  const blocked = disabled || (imageCount >= MAX_IMAGES && fileCount >= MAX_TEXT_FILES);
  const menu = useComposerMenu(blocked, false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <div
      className="composer-add-menu"
      ref={menu.root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          menu.close(false);
      }}
    >
      <input
        ref={input}
        type="file"
        accept={[...IMAGE_TYPES, TEXT_FILE_ACCEPT].join(",")}
        multiple
        hidden
        disabled={blocked}
        onChange={(event) => {
          if (!blocked) add([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <ActionButton
        ref={menu.trigger}
        className="composer-add-trigger ghost"
        aria-label={t("addAttachments")}
        title={t("addAttachments")}
        disabled={blocked}
        aria-haspopup="menu"
        aria-expanded={!!menu.page}
        aria-controls={menu.page ? id : undefined}
        onClick={() => (menu.page ? menu.close() : menu.setPage("main"))}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            menu.setPage("main");
          }
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </ActionButton>
      {menu.page && (
        <div
          id={id}
          className="composer-add-popover"
          ref={menu.panel}
          role="menu"
          aria-labelledby={id + "-heading"}
          onKeyDown={menu.navigate}
        >
          <div className="composer-add-heading" id={id + "-heading"} role="presentation">
            {t("addSection")}
          </div>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={blocked}
            onClick={() => {
              input.current?.click();
              menu.close();
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" />
              <path d="m8 13 6-6" />
            </svg>
            {t("attachFiles")}
          </button>
        </div>
      )}
    </div>
  );
};
