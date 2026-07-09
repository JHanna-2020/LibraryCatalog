import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Shared modal shell: backdrop click and Escape both close, focus moves into
 * the dialog on open and is restored on close.
 */
export default function Modal({
  title,
  onClose,
  children,
  narrow = false,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the dialog itself unless a child (e.g. autoFocus input) took it.
    if (ref.current && !ref.current.contains(document.activeElement)) {
      ref.current.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className={"modal" + (narrow ? " modal-narrow" : "") + (wide ? " modal-wide" : "")}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
