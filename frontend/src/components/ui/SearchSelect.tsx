import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

const MARGIN = 12; // aire mínimo contra el borde de la ventana
const PANEL_MAX = 320; // alto tope del panel (buscador + lista)

export interface SearchOption {
  value: string;
  label: string;
  /** Segunda línea y campo extra de búsqueda (p. ej. la cédula). */
  hint?: string;
}

interface SearchSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  /** Texto cuando no hay nada seleccionado. */
  placeholder?: string;
  /** Si se indica, aparece una fila al inicio que limpia la selección. */
  emptyLabel?: string;
  error?: string;
  disabled?: boolean;
  /** Texto del buscador del panel. */
  searchPlaceholder?: string;
}

/** Quita acentos y mayúsculas para que "PEREZ" encuentre "Pérez". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Selector con buscador: filtra por etiqueta y por `hint` (cédula).
 * Pensado para listas largas, donde un <select> nativo deja de servir.
 *
 * El panel se dibuja en un portal con posición fija, anclado al botón. Dentro de
 * un modal (que tiene su propio scroll) un panel `absolute` alargaba el contenido
 * y aparecía una segunda barra de desplazamiento; así flota por encima, se abre
 * hacia arriba si abajo no cabe y sigue al botón si el contenedor se desplaza.
 */
export function SearchSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  emptyLabel,
  error,
  disabled,
  searchPlaceholder = "Buscar por nombre o cédula…",
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - MARGIN;
      const above = r.top - MARGIN;
      // Abajo por defecto; arriba solo si abajo no cabe y arriba hay más sitio.
      const up = below < Math.min(PANEL_MAX, 220) && above > below;
      const maxHeight = Math.min(PANEL_MAX, (up ? above : below) - 6);
      const height = Math.min(panelRef.current?.offsetHeight ?? PANEL_MAX, maxHeight);
      setPos({
        left: r.left,
        width: r.width,
        top: up ? r.top - height - 6 : r.bottom + 6,
        maxHeight,
      });
    };
    update();
    // `true`: el scroll del modal no burbujea hasta la ventana.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, query]);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter(
      (o) => normalize(o.label).includes(q) || normalize(o.hint ?? "").includes(q)
    );
  }, [options, query]);

  // Filas navegables: la de "sin selección" cuenta como una más, al inicio.
  const rows: (SearchOption | null)[] = emptyLabel ? [null, ...filtered] : filtered;

  useEffect(() => {
    if (!open) return;
    // El panel vive en un portal: "fuera" es fuera del campo y fuera del panel.
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // El foco al buscador tras pintar el panel.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const choose = (option: SearchOption | null) => {
    onChange(option ? option.value : "");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows.length > 0) choose(rows[Math.min(highlight, rows.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Solo cierra el panel: sin esto, el Esc también cerraba el modal que lo contiene.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-ios-secondary">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-ios-fill px-3.5 text-left text-[15px]",
            "transition-shadow focus:outline-none focus:ring-2 disabled:opacity-40",
            error ? "ring-1 ring-ios-red/50 focus:ring-ios-red" : "focus:ring-brand-500/70"
          )}
        >
          <span className={cn("truncate", selected ? "text-ios-label" : "text-ios-secondary")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-ios-secondary transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && createPortal(
          <div
            ref={panelRef}
            // Primer render: se mide ya montado; hasta tener medidas queda fuera de la vista.
            style={pos ? { position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : { position: "fixed", top: -9999, left: -9999 }}
            className="popover-in z-[70] flex flex-col overflow-hidden rounded-2xl bg-ios-card shadow-ios-lg ring-1 ring-ios-separator"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-ios-separator px-3">
              <Search className="h-4 w-4 shrink-0 text-ios-secondary" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="h-11 w-full bg-transparent text-[15px] text-ios-label placeholder:text-ios-secondary focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="shrink-0 text-ios-secondary hover:text-ios-label"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {rows.length === 0 && (
                <li className="px-4 py-6 text-center text-[13px] text-ios-secondary">
                  Sin coincidencias
                </li>
              )}
              {rows.map((option, i) => {
                const isSelected = option ? option.value === value : !value;
                return (
                  <li key={option?.value ?? "__empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => choose(option)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left",
                        highlight === i && "bg-ios-fill"
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-[15px]",
                            option ? "text-ios-label" : "text-ios-secondary"
                          )}
                        >
                          {option ? option.label : emptyLabel}
                        </span>
                        {option?.hint && (
                          <span className="block truncate text-xs text-ios-secondary">
                            {option.hint}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
      </div>

      {error && <p className="text-[13px] font-medium text-ios-red">{error}</p>}
    </div>
  );
}
