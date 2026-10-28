import { BankEntry } from "../services/reconciliation.service";
import { Check } from "@/components/ui/Check";
import { EmptyBlock, LedgerEmpty, LedgerSkeleton } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { money } from "./ReconciliationResultModal";

interface EntriesTableProps {
  entries: BankEntry[];
  loading: boolean;
  hasFilters: boolean;
  onClear: () => void;
  selected: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const COLS = 6;

/** Conciliado es lo normal (gris con su visto); sin conciliar tampoco es alarma: solo falta su pago. */
function EntryStatus({ matched }: { matched: boolean }) {
  return matched ? (
    <StatusMark label="Conciliado" tone="success" quiet="check" />
  ) : (
    <StatusMark label="Sin conciliar" tone="neutral" />
  );
}

/**
 * Movimientos del banco en tabla libro. La fila entera marca o desmarca: lo que
 * se hace con un movimiento suelto es seleccionarlo para eliminarlo.
 */
export function EntriesTable(p: EntriesTableProps) {
  const empty = p.hasFilters
    ? { title: "Ningún movimiento coincide", hint: "Prueba con otra referencia, monto o rango de fechas.", onClear: p.onClear }
    : { title: "Aún no hay movimientos", hint: "Sube el extracto del banco en .xlsx para empezar a conciliar." };

  return (
    <>
      {/* ── Escritorio ── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table-ledger min-w-[760px]">
          <thead>
            <tr>
              <th className="w-px pl-5">
                <Check
                  checked={p.allSelected}
                  onChange={p.onToggleAll}
                  disabled={p.entries.length === 0}
                  title={p.allSelected ? "Quitar todos" : "Marcar todos los filtrados"}
                />
              </th>
              <th>Referencia</th>
              <th>Fecha</th>
              <th>Descripción</th>
              <th className="text-right">Monto</th>
              <th className="pr-5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {p.loading ? (
              <LedgerSkeleton cols={COLS} />
            ) : p.entries.length === 0 ? (
              <LedgerEmpty cols={COLS} {...empty} />
            ) : (
              p.entries.map((e) => {
                const on = p.selected.has(e.id);
                return (
                  <tr
                    key={e.id}
                    className={cn("ledger-row", on && "[&>td]:!bg-brand-50/60")}
                    tabIndex={0}
                    onClick={() => p.onToggle(e.id)}
                    onKeyDown={(ev) => (ev.key === " " || ev.key === "Enter") && (ev.preventDefault(), p.onToggle(e.id))}
                    aria-selected={on}
                  >
                    <td className="pl-5">
                      <Check checked={on} onChange={() => p.onToggle(e.id)} title="Seleccionar movimiento" />
                    </td>
                    <td className="font-medium tabular-nums text-ios-label">{e.referencia}</td>
                    <td className="whitespace-nowrap">
                      <p className="tabular-nums text-ios-label">{e.fecha ? formatDate(e.fecha) : "—"}</p>
                      <p className="text-[12px] text-ios-secondary">Subido el {formatDate(e.uploadedAt)}</p>
                    </td>
                    <td className="max-w-[260px] truncate text-ios-secondary" title={e.descripcion ?? undefined}>
                      {e.descripcion || "—"}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Money value={money(e.monto, e.currency)} className="font-semibold text-ios-label" />
                    </td>
                    <td className="pr-5">
                      <EntryStatus matched={e.matched} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Móvil ── */}
      <div className="space-y-2 p-3 md:hidden">
        {p.loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full !rounded-xl" />)
        ) : p.entries.length === 0 ? (
          <EmptyBlock {...empty} />
        ) : (
          p.entries.map((e) => {
            const on = p.selected.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => p.onToggle(e.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  on ? "border-brand-500/40 bg-brand-50/60" : "border-ios-separator active:bg-ios-fill"
                )}
              >
                <Check checked={on} onChange={() => p.onToggle(e.id)} title="Seleccionar movimiento" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold tabular-nums text-ios-label">{e.referencia}</span>
                    <Money value={money(e.monto, e.currency)} className="shrink-0 font-semibold text-ios-label" />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-ios-secondary">
                    <span className="truncate">{[e.fecha && formatDate(e.fecha), e.descripcion].filter(Boolean).join(" · ")}</span>
                    <EntryStatus matched={e.matched} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
