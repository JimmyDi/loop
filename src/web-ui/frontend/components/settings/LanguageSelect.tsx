import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { ActionButton } from "../ui/ActionButton";
import "./LanguageSelect.css";

const languages = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
] as const;

export const LanguageSelect = ({ labelId }: { labelId: string }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const selected = i18n.resolvedLanguage === "zh" ? 0 : 1;

  useEffect(() => {
    if (!open) return;

    options.current[selected]?.focus();

    const dismiss = (event: PointerEvent) => {
      if (event.target && !root.current?.contains(event.target as Node)) {
        setOpen(false);
        trigger.current?.focus();
      }
    };

    document.addEventListener("pointerdown", dismiss);

    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, selected]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const navigate = (event: KeyboardEvent<HTMLUListElement>) => {
    const current = options.current.findIndex((option) => option === document.activeElement);
    let next: number;

    switch (event.key) {
      case "ArrowDown":
        next = (current + 1) % languages.length;
        break;
      case "ArrowUp":
        next = (current + languages.length - 1) % languages.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = languages.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        // Resume native tab order from the trigger before removing the focused option.
        close();
        return;
      default:
        next = languages.findIndex((language) =>
          language.label.toLowerCase().startsWith(event.key.toLowerCase()),
        );
        if (next === -1) return;
    }

    event.preventDefault();
    options.current[next]?.focus();
  };

  return (
    <div
      className="language-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <ActionButton
        ref={trigger}
        className="language-select-trigger ghost"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id + "-options" : undefined}
        aria-labelledby={labelId + " " + id + "-value"}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={id + "-value"}>{languages[selected].label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </ActionButton>
      {open && (
        <ul
          id={id + "-options"}
          className="language-select-options"
          role="listbox"
          aria-labelledby={labelId}
          onKeyDown={navigate}
        >
          {languages.map((language, index) => (
            <li key={language.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={index === selected}
                tabIndex={-1}
                ref={(element) => {
                  options.current[index] = element;
                }}
                onClick={() => {
                  void i18n.changeLanguage(language.value);
                  close();
                }}
              >
                {language.label}
                {index === selected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
