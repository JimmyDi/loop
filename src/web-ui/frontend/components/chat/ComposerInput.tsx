import { useComposerInput } from "../../hooks/useComposerInput";
import "./ComposerInput.css";

export const ComposerInput = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange(text: string): void;
  onSubmit(): void;
  disabled: boolean;
  placeholder: string;
}) => {
  const editor = useComposerInput(value, onChange, onSubmit);

  return (
    <div
      {...editor}
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
