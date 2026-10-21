import { Pencil } from "lucide-react";
import { PropertyWithBalance } from "@/features/admin-panel/types";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyBlock, LedgerEmpty, LedgerSkeleton, ledgerRow, ROW_TONE, RowIcon, stopRow } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDocumentId } from "@/lib/format";
import { cn } from "@/lib/cn";

const EPS = 0.005;
const COLS = 5;

interface UnitsTableProps {
  units: PropertyWithBalance[];
  loading: boolean;
  hasQuery: boolean;
  onClear: () => void;
  onOpen: (unit: PropertyWithBalance) => void;
  onEdit: (unit: PropertyWithBalance) => void;
}

/** Código del departamento en su recuadro: el ancla visual de cada fila. */
function UnitCode({ unit }: { unit: PropertyWithBalance }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 min-w-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-ios-fill px-2 text-[13px] font-bold tabular-nums text-ios-label">
        {unit.code}
      </span>
      <span className="truncate text-[12px] text-ios-secondary">{unit.tower?.name ?? "Sin torre"}</span>
    </div>
  );
}

function Balance({ unit }: { unit: PropertyWithBalance }) {
  const b = Number(unit.balance);
  return b > EPS ? (
    <Money value={formatCurrency(b)} className="font-semibold text-red-600 dark:text-red-400" />
  ) : (
    <StatusMark label="Al día" tone="success" quiet="check" />
  );
}

/** Quién opera la unidad además del titular; si es el mismo, se dice sin repetir el nombre. */
function Authorized({ unit }: { unit: PropertyWithBalance }) {
  if (!unit.authorized) return <span className="text-ios-tertiary">—</span>;
  if (unit.authorized.id === unit.owner?.id) return <span className="text-[13px] text-ios-secondary">El mismo titular</span>;
  return <span className="truncate text-ios-label">{unit.authorized.fullName}</span>;
}

/**
 * Departamentos en tabla libro desde `md`; tarjetas por debajo. La fila abre sus
 * cuotas, que es lo que más se consulta; editar va aparte.
 */
export function UnitsTable({ units, loading, hasQuery, onClear, onOpen, onEdit }: UnitsTableProps) {
  const empty = hasQuery
    ? { title: "Ningún departamento coincide", hint: "Prueba con otro código, torre o nombre.", onClear }
    : { title: "Sin departamentos", hint: "Crea el primero y asígnale su titular." };

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="table-ledger min-w-[760px]">
          <thead>
            <tr>
              <th className="pl-5">Departamento</th>
              <th>Titular</th>
              <th>Autorizado</th>
              <th className="text-right">Saldo</th>
              <th className="w-px pr-5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LedgerSkeleton cols={COLS} />
            ) : units.length === 0 ? (
              <LedgerEmpty cols={COLS} {...empty} />
            ) : (
              units.map((u) => (
                <tr key={u.id} {...ledgerRow(() => onOpen(u), Number(u.balance) > EPS ? ROW_TONE.danger : undefined)}>
                  <td className="w-[26%] max-w-0 pl-5">
                    <UnitCode unit={u} />
                  </td>
                  <td className="max-w-0">
                    {u.owner ? (
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={u.owner.fullName} className="!h-8 !w-8 !text-[11px]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ios-label">{u.owner.fullName}</p>
                          <p className="truncate text-[12px] tabular-nums text-ios-secondary">
                            {formatDocumentId(u.owner.cedulaTipo, u.owner.cedula)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <StatusMark label="Sin titular" tone="warning" />
                    )}
                  </td>
                  <td className="max-w-0">
                    <Authorized unit={u} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Balance unit={u} />
                  </td>
                  <td className="cursor-default pr-5" onClick={stopRow}>
                    <RowIcon icon={Pencil} title="Editar departamento" onClick={() => onEdit(u)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[72px] w-full !rounded-xl" />)
        ) : units.length === 0 ? (
          <EmptyBlock {...empty} />
        ) : (
          units.map((u) => {
            const owes = Number(u.balance) > EPS;
            return (
              <div
                key={u.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(u)}
                onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && onOpen(u)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-ios-separator p-3 transition-colors active:bg-ios-fill",
                  owes && "shadow-[inset_3px_0_0_#ef4444]"
                )}
              >
                <span className="flex h-11 min-w-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-ios-fill px-2 text-[13px] font-bold tabular-nums text-ios-label">
                  {u.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ios-label">{u.owner?.fullName ?? "Sin titular"}</p>
                  <p className="truncate text-[12px] text-ios-secondary">{u.tower?.name ?? "Sin torre"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Balance unit={u} />
                </div>
                <div onClick={stopRow} onKeyDown={stopRow}>
                  <RowIcon icon={Pencil} title="Editar departamento" onClick={() => onEdit(u)} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
