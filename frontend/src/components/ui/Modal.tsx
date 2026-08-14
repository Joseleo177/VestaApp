import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Hoja modal iOS: sube desde abajo en móvil, se centra en escritorio. */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal al body: si el modal se monta dentro de un ancestro con
  // backdrop-filter (la barra superior), ese ancestro se vuelve el bloque
  // contenedor de los `fixed` y el diálogo se centraría dentro de la barra.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full bg-ios-card shadow-ios-lg",
          "rounded-t-3xl sm:rounded-3xl sm:max-w-lg",
          "max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        {/* Indicador de arrastre — solo móvil */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <div className="h-1.5 w-9 rounded-full bg-ios-tertiary" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
          <h2 className="text-[17px] font-semibold text-ios-label">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ios-fill text-ios-secondary transition-colors hover:bg-ios-separator hover:text-ios-label"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="px-5 pb-6 pt-2 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
