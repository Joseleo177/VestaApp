import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 12; // aire mínimo contra el borde de la ventana
const WIDTH = 288;

interface FilterPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  width?: number;
}

/**
 * Panel de filtros anclado a un botón. Se dibuja en un portal: dentro de una
 * tarjeta con `overflow-hidden` un panel `absolute` queda recortado por la
 * tarjeta, no por la ventana. Se alinea al borde derecho del botón cuando cabe,
 * se corre lo justo cuando no, y se abre hacia arriba si abajo no hay sitio.
 */
export function FilterPopover({ open, onClose, anchorRef, children, width = WIDTH }: FilterPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(width, window.innerWidth - MARGIN * 2);
      const left = Math.max(MARGIN, Math.min(r.right - w, window.innerWidth - w - MARGIN));

      const height = panelRef.current?.offsetHeight ?? 0;
      const below = window.innerHeight - r.bottom - MARGIN;
      const up = height > below && r.top - MARGIN > below;

      setPos({
        left,
        top: up ? Math.max(MARGIN, r.top - height - 4) : r.bottom + 4,
        width: w,
        maxHeight: (up ? r.top : window.innerHeight - r.bottom) - MARGIN * 2,
      });
    };
    update();
    // `true`: los contenedores internos con scroll propio no burbujean el evento.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, width, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        // Primer render: se mide ya montado, así que hasta tener medidas queda
        // fuera de la vista en vez de parpadear en la esquina.
        style={
          pos
            ? { position: "fixed", ...pos }
            : { position: "fixed", top: -9999, left: -9999, width }
        }
        className="popover-in no-scrollbar z-[70] overflow-y-auto rounded-2xl border border-black/[0.06] bg-ios-card shadow-ios-lg dark:border-white/10"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

/** Bloque titulado dentro del panel de filtros. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-ios-separator px-4 py-3 last:border-b-0">
      <p className="mb-2 text-[12px] font-medium text-ios-secondary">{title}</p>
      {children}
    </div>
  );
}

/** Opción conmutable del panel de filtros. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors " +
        (active
          ? "border-brand-500/40 bg-brand-50 text-brand-700"
          : "border-ios-separator text-ios-secondary hover:bg-ios-fill hover:text-ios-label")
      }
    >
      {children}
    </button>
  );
}
