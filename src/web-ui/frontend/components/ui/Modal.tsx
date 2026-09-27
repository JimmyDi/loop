import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { ActionButton } from "./ActionButton";
import "./Modal.css";

export const Modal = ({
  title,
  children,
  onClose,
  className = "",
  closeLabel,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
  className?: string;
  closeLabel?: string;
}) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const view = dialog?.ownerDocument.defaultView;

    dialog?.showModal();

    return () => {
      dialog?.close();

      if (view && previous instanceof view.HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={"modal " + className}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {closeLabel ? (
        <header className="modal-header">
          <h2>{title}</h2>
          <ActionButton className="modal-close ghost" aria-label={closeLabel} onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </ActionButton>
        </header>
      ) : (
        <h2>{title}</h2>
      )}
      {children}
    </dialog>
  );
};
