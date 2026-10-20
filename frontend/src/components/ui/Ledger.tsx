import { ButtonHTMLAttributes, CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { FileText, Loader2, LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Piezas comunes de las tablas .table-ledger (ver index.css): filas que abren su
// detalle, esqueleto de carga, estado vacío y botones de icono.

/**
 * Props de una fila clicable. `open` es lo que hace la fila entera (casi siempre,
 * abrir el detalle); `tone` pinta el filete izquierdo cuando la fila pide atención.
 * Enter y espacio la abren igual que el clic.
 */
export const ledgerRow = (open?: () => void, tone?: string) => ({
  className: open ? "ledger-row" : undefined,
  tabIndex: open ? 0 : undefined,
  onClick: open,
  onKeyDown: open
    ? (e: KeyboardEvent<HTMLElement>) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          open();
        }
      }
    : undefined,
  "data-tone": tone ? "" : undefined,
  style: tone ? ({ "--row-tone": tone } as CSSProperties) : undefined,
});

/** Celda de acciones: el clic en un botón no debe abrir además el detalle de la fila. */
export const stopRow = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

/** Colores de filete de fila, a juego con StatusMark. */
export const ROW_TONE = {
  danger: "#ef4444",
  warning: "#f59e0b",
} as const;

const SKELETON_WIDTHS = ["w-40", "w-24", "w-20", "w-28", "w-16 ml-auto", "w-12 ml-auto"];

export function LedgerSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className={j === 0 ? "pl-5" : j === cols - 1 ? "pr-5" : ""}>
              <div
                className={cn(
                  "h-2.5 animate-pulse rounded-full bg-ios-fill",
                  SKELETON_WIDTHS[j % SKELETON_WIDTHS.length]
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface EmptyProps {
  title: string;
  hint?: string;
  /** Si hay filtros puestos, ofrece quitarlos: suele ser la salida del vacío. */
  onClear?: () => void;
  /** Salida propia del vacío (un enlace, un botón). */
  action?: ReactNode;
}

/** Contenido del estado vacío, usable dentro o fuera de una tabla. */
export function EmptyBlock({ title, hint, onClear, action }: EmptyProps) {
  return (
    <div className="px-6 py-16 text-center">
      <FileText className="mx-auto mb-3 h-8 w-8 text-ios-tertiary" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold text-ios-label">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[13px] text-ios-secondary">{hint}</p>}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 h-8 rounded-lg bg-ios-fill px-3 text-[13px] font-semibold text-ios-label transition-colors hover:bg-ios-separator"
        >
          Quitar filtros
        </button>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LedgerEmpty({ cols, ...props }: EmptyProps & { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="!h-auto">
        <EmptyBlock {...props} />
      </td>
    </tr>
  );
}

// `tone` solo tiñe el hover: en reposo todos los iconos van en gris.
const HOVER = {
  danger: "hover:!bg-red-500/10 hover:!text-red-600 dark:hover:!text-red-400",
  success: "hover:!bg-emerald-500/10 hover:!text-emerald-700 dark:hover:!text-emerald-400",
} as const;

interface RowIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof HOVER;
  busy?: boolean;
}

/** Botón de icono de fila, con su `title` también como etiqueta accesible. */
export function RowIcon({ icon: Icon, title, tone, busy, disabled, className, ...props }: RowIconProps) {
  return (
    <button
      type="button"
      className={cn("row-icon", tone && HOVER[tone], className)}
      title={title}
      aria-label={title}
      disabled={busy || disabled}
      {...props}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    </button>
  );
}
