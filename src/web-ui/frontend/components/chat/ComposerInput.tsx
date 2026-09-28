import { useComposerInput } from "../../hooks/useComposerInput";
import "./ComposerInput.css";

export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  onImages,
}: {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
  onImages?(files: File[]): void;
}) => {
  const editor = useComposerInput(value, onChange, onSubmit);

  return (
    <div
      {...editor}
      onPaste={(event) => {
        if (disabled) return;
        const images = [...event.clipboardData.files].filter((file) =>
          file.type.startsWith("image/"),
        );
        if (images.length && onImages) {
          event.preventDefault();
          onImages(images);
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
