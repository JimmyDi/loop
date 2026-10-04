import { useEffect } from "react";

import { useComposerInput } from "../../hooks/useComposerInput";
import "./ComposerInput.css";

export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  onFiles,
  focusRequest = 0,
}: {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
  onFiles?(files: File[]): void;
  focusRequest?: number;
}) => {
  const editor = useComposerInput(value, onChange, onSubmit);

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
    <div
      {...editor}
      onPaste={(event) => {
        if (disabled) return;
        const files = [...event.clipboardData.files];
        if (files.length && onFiles) {
          event.preventDefault();
          onFiles(files);
        } else editor.onPaste(event);
      }}
      className="composer-input"
      contentEditable={!disabled}
      tabIndex={disabled ? -1 : 0}
      role="textbox"
      aria-label={placeholder}
      aria-multiline="true"
      aria-disabled={disabled}
      data-placeholder={placeholder}
      data-empty={!value}
      suppressContentEditableWarning
      spellCheck
    />
  );
};
