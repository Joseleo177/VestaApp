import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChargeType, RateCurrency } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyBlock, LedgerSkeleton, ledgerRow, ROW_TONE, RowIcon, stopRow } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatBs, formatCurrency, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";
import { PeriodRow } from "../hooks/usePeriods";

interface PeriodsTableProps {
  periods: PeriodRow[];
  loading: boolean;
  onSelect: (period: string, type: string) => void;
  onDeleted: () => void;
  onCreate: () => void;
}

/** Barra de cobranza: cuánto del período ya entró. Verde al completarse. */
function Progress({ p }: { p: NonNullable<PeriodRow["progress"]> }) {
  const pct = p.billable > 0 ? Math.round((p.collected / p.billable) * 100) : 100;
  const done = p.open === 0;
  return (
    <div className="min-w-[150px]">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-semibold tabular-nums text-ios-label">{pct}%</span>
        <span className="text-ios-secondary">
          {done ? "Cobrado completo" : `${p.paid} de ${p.paid + p.open} pagadas`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ios-fill" aria-hidden>
        <div
          className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-brand-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Nombre del período, la marca de especial y cuántas cuotas lleva. */
function PeriodName({ p }: { p: PeriodRow }) {
  const pr = p.progress;
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-ios-label">{formatPeriod(p.period)}</span>
        {p.type === ChargeType.SPECIAL && (
          <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            Especial
          </span>
        )}
      </div>
      <p className="text-[12px] text-ios-secondary">
        {p.count} {p.count === 1 ? "cuota" : "cuotas"}
        {pr && pr.exonerated > 0 && ` · ${pr.exonerated} exonerada${pr.exonerated === 1 ? "" : "s"}`}
      </p>
    </>
  );
}

/** Lo que falta por cobrar del período y cuántas cuotas ya vencieron. */
function Remaining({ p }: { p: PeriodRow }) {
  const pr = p.progress;
  if (!pr) return <span className="text-ios-tertiary">—</span>;
  const remaining = Math.max(0, pr.billable - pr.collected);
  if (remaining <= 0.005) return <StatusMark label="Nada" tone="success" quiet="check" />;
  return (
    <>
      <Money value={formatCurrency(remaining)} className="font-semibold text-ios-label" />
      {pr.overdue > 0 && (
        <p className="text-[12px] font-medium text-red-600 dark:text-red-400">
          {pr.overdue} vencida{pr.overdue === 1 ? "" : "s"}
        </p>
      )}
    </>
  );
}

/**
 * Períodos emitidos, del más reciente al más viejo, cada uno con su cobranza. En
 * tabla libro desde `md`; tarjetas por debajo. La fila abre las cuotas del
 * período; un filete rojo marca los que tienen cuotas vencidas sin pagar.
 */
export function PeriodsTable({ periods, loading, onSelect, onDeleted, onCreate }: PeriodsTableProps) {
  const { rateOf } = useExchangeRate();
  const [target, setTarget] = useState<PeriodRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await billingService.deletePeriod(target.period, target.type);
      toast.success(`Cuotas de ${formatPeriod(target.period)} eliminadas`);
      setTarget(null);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron eliminar las cuotas");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        {!loading && periods.length === 0 ? (
          <EmptyBlock
            title="Todavía no has emitido cuotas"
            hint="Emite la cuota del mes y aquí verás cuánto se ha cobrado de cada período."
            action={
              <button
                type="button"
                onClick={onCreate}
                className="h-10 rounded-xl bg-brand-600 px-4 text-[14px] font-semibold text-white hover:brightness-95"
              >
                Emitir cuotas
              </button>
            }
          />
        ) : (
          <>
            {/* `relative`: el sr-only de "Acciones" es absoluto y, sin un ancestro
                posicionado, escapaba del scroll y ensanchaba la página. */}
            <div className="relative hidden overflow-x-auto md:block">
              <table className="table-ledger min-w-[860px]">
                <thead>
                  <tr>
                    <th className="pl-5">Período</th>
                    <th>Cobranza</th>
                    <th className="text-right">Emitido</th>
                    <th className="text-right">Por cobrar</th>
                    <th>Tasa</th>
                    <th className="w-px pr-5">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LedgerSkeleton cols={6} rows={4} />
                  ) : (
                    periods.map((p) => {
                      // Un lote con cuotas a dos tasas no tiene un único equivalente en Bs.
                      const single = p.currencies?.length === 1 ? p.currencies[0] : null;
                      const rate = single ? rateOf(single) : null;
                      const pr = p.progress;
                      return (
                        <tr
                          key={`${p.period}-${p.type}`}
                          {...ledgerRow(() => onSelect(p.period, p.type), pr && pr.overdue > 0 ? ROW_TONE.danger : undefined)}
                        >
                          <td className="pl-5">
                            <PeriodName p={p} />
                          </td>
                          <td>{pr ? <Progress p={pr} /> : <span className="text-ios-tertiary">—</span>}</td>
                          <td className="whitespace-nowrap text-right">
                            <Money value={formatCurrency(p.total)} className="font-semibold text-ios-label" />
                            <p className="text-[12px] tabular-nums text-ios-secondary">
                              {rate ? `≈ ${formatBs(p.total, rate.rate)}` : "Tasa mixta"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            <Remaining p={p} />
                          </td>
                          <td>
                            <span className="text-[12px] font-medium text-ios-secondary">
                              {single ? `Tasa del ${single === RateCurrency.USD ? "dólar" : "euro"}` : "Tasas mixtas"}
                            </span>
                          </td>
                          <td className="cursor-default pr-5" onClick={stopRow}>
                            <RowIcon
                              icon={Trash2}
                              tone="danger"
                              title="Eliminar las cuotas del período"
                              onClick={() => setTarget(p)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
  
            <div className="space-y-2 p-3 md:hidden">
              {loading
                ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px] w-full !rounded-xl" />)
                : periods.map((p) => {
                    const pr = p.progress;
                    const open = () => onSelect(p.period, p.type);
                    return (
                      <div
                        key={`${p.period}-${p.type}`}
                        role="button"
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && open()}
                        className={cn(
                          "rounded-xl border border-ios-separator p-3 transition-colors active:bg-ios-fill",
                          pr && pr.overdue > 0 && "shadow-[inset_3px_0_0_#ef4444]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 text-[14px]">
                            <PeriodName p={p} />
                          </div>
                          <div className="shrink-0 text-right text-[13px]">
                            <Remaining p={p} />
                          </div>
                          <div onClick={stopRow} onKeyDown={stopRow}>
                            <RowIcon
                              icon={Trash2}
                              tone="danger"
                              title="Eliminar las cuotas del período"
                              onClick={() => setTarget(p)}
                            />
                          </div>
                        </div>
                        {pr && (
                          <div className="mt-3">
                            <Progress p={pr} />
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={handleDelete}
        title={`¿Eliminar las cuotas de ${target ? formatPeriod(target.period) : ""}?`}
        description={`Se eliminarán las ${target?.count ?? ""} cuotas ${
          target?.type === ChargeType.SPECIAL ? "especiales" : "regulares"
        } del período. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cuotas"
        loading={deleting}
      />
    </>
  );
}
