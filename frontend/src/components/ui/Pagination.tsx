import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  /** Cómo llamar a los elementos en el resumen. Ej. "departamentos". */
  label?: string;
  className?: string;
}

/**
 * Devuelve los números de página a mostrar, con "…" donde se saltan
 * tramos. Siempre incluye la primera, la última y las vecinas a la actual.
 */
function pageNumbers(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < totalPages) pages.add(page + 1);
  // Con la actual pegada a un extremo, mostramos una vecina más para no
  // dejar la barra más corta de lo normal.
  if (page <= 3) pages.add(Math.min(4, totalPages - 1));
  if (page >= totalPages - 2) pages.add(Math.max(totalPages - 3, 2));

  const ordered = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  ordered.forEach((n, i) => {
    if (i > 0 && n - ordered[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
  label = "registros",
  className,
}: PaginationProps) {
  // Con una sola página la barra no aporta nada.
  if (totalPages <= 1) return null;

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-ios-separator px-5 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-ios-secondary">
        {from}–{to} de {total} {label}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(btn, "text-ios-secondary hover:bg-ios-fill hover:text-ios-label")}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageNumbers(page, totalPages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-ios-secondary">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={cn(
                btn,
                n === page
                  ? "bg-brand-600 text-white"
                  : "text-ios-label hover:bg-ios-fill"
              )}
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          className={cn(btn, "text-ios-secondary hover:bg-ios-fill hover:text-ios-label")}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}