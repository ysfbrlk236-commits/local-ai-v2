import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Açılır menü: dışarı tıklayınca ya da Esc ile kapanır. Mesaj kutusu
 * altında olduğu için panel yukarı doğru açılır.
 */
export function Popover({
  label,
  title,
  className,
  align = "left",
  onOpen,
  children,
}: {
  label: ReactNode;
  title?: string;
  className?: string;
  align?: "left" | "right";
  onOpen?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={rootRef}>
      <button
        type="button"
        className={className}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((v) => !v);
        }}
      >
        {label}
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className="popover__caret">
          <path d="M2.5 7.5L6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open && (
        <div className={`popover__panel popover__panel--${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
