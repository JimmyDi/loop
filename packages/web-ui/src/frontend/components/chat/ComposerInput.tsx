import { useEffect } from "react";

import { useComposerInput } from "../../hooks/useComposerInput";
import { useWorkspace } from "../../state/workspace-store";
import { readSkillMessage } from "../../lib/skill-clipboard";
import { insertPlainText, readComposer } from "../../lib/composer-dom";
import { ComposerSkillTokens } from "./ComposerSkillTokens";
import "./ComposerInput.css";

export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  onFiles,
  focusRequest = 0,
  sessionId,
  hideSkills = false,
}: {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
  onFiles?(files: File[]): void;
  focusRequest?: number;
  sessionId?: string;
  hideSkills?: boolean;
}) => {
  const editor = useComposerInput(value, onChange, onSubmit);
  const skills = useWorkspace((state) => (sessionId ? state.skills[sessionId] : undefined));
  const visibleSkills = hideSkills ? [] : (skills ?? []);
  const removeSkill = (id: string) => {
    if (!sessionId || disabled) return;
    useWorkspace.getState().removeSkill(sessionId, id);
    editor.ref.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const input = editor.ref.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    const selection = input.ownerDocument.getSelection();
    const range = input.ownerDocument.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editor.ref, focusRequest]);

  return (
    <div className="composer-input-area">
      <ComposerSkillTokens skills={visibleSkills} disabled={disabled} />
      <div
        {...editor}
        onKeyDown={(event) => {
          if (
            !disabled &&
            skills?.length &&
            event.key === "Backspace" &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            const selection = event.currentTarget.ownerDocument.getSelection();
            if (
              selection?.isCollapsed &&
              selection.rangeCount &&
              event.currentTarget.contains(selection.anchorNode)
            ) {
              const before = selection.getRangeAt(0).cloneRange();
              before.selectNodeContents(event.currentTarget);
              before.setEnd(selection.anchorNode!, selection.anchorOffset);
              if (!before.toString()) {
                event.preventDefault();
                removeSkill(skills[skills.length - 1]!.id);
                return;
              }
            }
          }
          editor.onKeyDown(event);
        }}
        onPaste={(event) => {
          if (disabled) return;
          const files = [...event.clipboardData.files];
          if (files.length && onFiles) {
            event.preventDefault();
            onFiles(files);
            return;
          }
          const copied = sessionId
            ? readSkillMessage(
                event.clipboardData.getData("text/html"),
                event.clipboardData.getData("text/plain"),
              )
            : undefined;
          const merged = new Set([...(skills ?? []), ...(copied?.skills ?? [])].map((s) => s.id));
          if (copied && sessionId && merged.size <= 8 && editor.ref.current) {
            event.preventDefault();
            for (const skill of copied.skills)
              useWorkspace.getState().selectSkill(sessionId, skill);
            insertPlainText(editor.ref.current, copied.text);
            onChange(readComposer(editor.ref.current));
            return;
          }
          editor.onPaste(event);
        }}
        className="composer-input"
        contentEditable={!disabled}
        tabIndex={disabled ? -1 : 0}
        role="textbox"
        aria-label={placeholder}
        aria-multiline="true"
        aria-disabled={disabled}
        data-placeholder={placeholder}
        data-empty={!value && !visibleSkills.length}
        suppressContentEditableWarning
        spellCheck
      />
    </div>
  );
};
