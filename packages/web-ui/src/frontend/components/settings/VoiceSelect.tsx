import { useId } from "react";

import { useComposerMenu } from "../../hooks/useComposerMenu";
import { ActionButton } from "../ui/ActionButton";
import type { VoiceSelectProps } from "./voice-select-types";
import "./VoiceSelect.css";

export const VoiceSelect = ({
  label,
  value,
  disabled = false,
  options,
  onChange,
}: VoiceSelectProps) => {
  const id = useId();
  const menu = useComposerMenu(disabled, false);
  return (
    <div
      className="voice-select"
      ref={menu.root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
          menu.close(false);
      }}
    >
      <ActionButton
        ref={menu.trigger}
        className="voice-select-trigger ghost"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!menu.page}
        aria-controls={menu.page ? id : undefined}
        onClick={() => (menu.page ? menu.close() : menu.open("main"))}
        onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            menu.open("main");
          }
        }}
      >
        <span>{options.find((option) => option.value === value)?.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </ActionButton>
      {menu.page && (
        <div
          id={id}
          className="voice-select-options"
          role="menu"
          aria-label={label}
          ref={menu.panel}
          onKeyDown={menu.navigate}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              aria-labelledby={id + index + "-name"}
              aria-describedby={option.description ? id + index + "-hint" : undefined}
              tabIndex={-1}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(option.value);
                menu.close();
              }}
            >
              <span className="voice-select-option-copy">
                <span id={id + index + "-name"}>{option.name}</span>
                {option.description && (
                  <small id={id + index + "-hint"}>{option.description}</small>
                )}
              </span>
              <span aria-hidden="true">{value === option.value ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
