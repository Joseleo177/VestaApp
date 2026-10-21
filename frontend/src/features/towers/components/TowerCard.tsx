import { Link } from "react-router-dom";
import { ArrowRight, Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RowIcon } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TowerStats } from "../hooks/useTowersOverview";

interface TowerCardProps {
  stats: TowerStats;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Una torre con su estado: departamentos, cuántos están al día (con su barra) y
 * cuánto deben. El rojo solo aparece si hay deuda.
 */
export function TowerCard({ stats: s, onEdit, onDelete }: TowerCardProps) {
  const pct = s.units ? Math.round((s.current / s.units) * 100) : 0;
  const canDelete = s.units === 0;

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-ios-md">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/[0.12] text-teal-600 dark:text-teal-400">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold text-ios-label">{s.tower.name}</h3>
          <p className="truncate text-[13px] text-ios-secondary">{s.tower.description || "Sin descripción"}</p>
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0">
          <RowIcon icon={Pencil} title="Editar torre" onClick={onEdit} />
          <RowIcon
            icon={Trash2}
            tone="danger"
            onClick={onDelete}
            disabled={!canDelete}
            title={
              canDelete
                ? "Eliminar torre"
                : `Tiene ${s.units} ${s.units === 1 ? "departamento" : "departamentos"}: reasígnalos antes de eliminarla`
            }
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 border-y border-ios-separator">
        <div className="px-5 py-3">
          <dt className="text-[12px] text-ios-secondary">Departamentos</dt>
          <dd className="mt-0.5 text-[20px] font-bold text-ios-label">{s.units}</dd>
        </div>
        <div className="border-l border-ios-separator px-5 py-3">
          <dt className="text-[12px] text-ios-secondary">Deuda</dt>
          <dd className="mt-0.5 text-[20px] font-bold">
            {s.debt > 0 ? (
              <Money value={formatCurrency(s.debt)} className="text-red-600 dark:text-red-400" />
            ) : (
              <span className="text-ios-label">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex-1 px-5 py-4">
        {s.units === 0 ? (
          <p className="text-[13px] text-ios-secondary">Todavía no tiene departamentos asignados.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ios-secondary">Al día</span>
              <span className="font-semibold tabular-nums text-ios-label">
                {s.current} de {s.units}
                {s.debtors > 0 && (
                  <span className="font-medium text-red-600 dark:text-red-400"> · {s.debtors} con deuda</span>
                )}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-ios-fill"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={`${pct}% de los departamentos al día`}
            >
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", pct === 100 ? "bg-emerald-500" : "bg-brand-600")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </div>

      <Link
        to="/admin/departamentos"
        className="flex items-center justify-between border-t border-ios-separator px-5 py-3 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-ios-fill/50"
      >
        Ver departamentos
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Card>
  );
}

/** Tarjeta punteada al final de la rejilla: crear una torre donde se ven las demás. */
export function NewTowerCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ios-separator text-ios-secondary transition-colors hover:border-brand-500/50 hover:bg-brand-50/40 hover:text-brand-600"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ios-fill">
        <Plus className="h-6 w-6" />
      </span>
      <span className="text-[14px] font-semibold">Nueva torre</span>
    </button>
  );
}
