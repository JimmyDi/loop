import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { SelectHTMLAttributes, KeyboardEvent } from "react";
import "./ScheduleSelect.css";

export const ScheduleSelect = ({
  children,
  value,
  defaultValue,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => {
  const options = Children.toArray(children).filter(
    isValidElement<{ value: string | number; children: string }>,
  );
  const [local, setLocal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const search = useRef({ term: "", time: 0 });
  const selected =
    options.find((o) => String(o.props.value) === String(value ?? local)) ?? options[0];
  useLayoutEffect(() => {
    if (!open) return;
    const item = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    item?.focus({ preventScroll: true });
    item?.scrollIntoView?.({ block: "nearest" });
    list.current?.scrollIntoView?.({ block: "nearest" });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const choose = (choice: string) => {
    if (select.current) {
      select.current.value = choice;
      select.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
  };
  const navigate = (event: KeyboardEvent<HTMLSpanElement>) => {
    const items = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    let next = index;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, items.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        if (
          event.key.length !== 1 ||
          event.key === " " ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const now = Date.now();
        search.current = {
          term:
            (now - search.current.time < 600 ? search.current.term : "") + event.key.toLowerCase(),
          time: now,
        };
        next = items.findIndex((item) =>
          item.textContent?.trim().toLowerCase().startsWith(search.current.term),
        );
    }
    event.preventDefault();
    items[next]?.focus();
  };
  return (
    <span
      className="schedule-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="schedule-select-trigger"
        aria-label={props["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        ref={trigger}
        disabled={!options.length || props.disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected?.props.children}
      </button>
      <select
        {...props}
        hidden
        aria-hidden="true"
        ref={select}
        value={selected?.props.value ?? ""}
        onChange={(event) => {
          setLocal(event.target.value);
          onChange?.(event);
        }}
      >
        {children}
      </select>
      {open && (
        <span
          id={id}
          ref={list}
          role="listbox"
          aria-label={
            props["aria-label"] ??
            trigger.current?.labels?.[0]?.firstChild?.textContent ??
            undefined
          }
          className="schedule-select-list"
          onKeyDown={navigate}
        >
          {options.map((o) => (
            <button
              type="button"
              key={o.props.value}
              role="option"
              aria-label={o.props.children}
              tabIndex={-1}
              aria-selected={o === selected}
              onClick={() => choose(String(o.props.value))}
            >
              {o.props.children}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};
