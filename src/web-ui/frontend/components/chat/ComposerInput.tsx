import { useComposerInput } from "../../hooks/useComposerInput";
import "./ComposerInput.css";

export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  onFiles,
}: {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
  onFiles?(files: File[]): void;
}) => {
  const editor = useComposerInput(value, onChange, onSubmit);

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
