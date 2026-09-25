import { useState } from "react";
import { Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBs, formatCurrency, formatPeriod, rateLabel } from "@/lib/format";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { PeriodSummary, billingService } from "../services/billing.service";
import { ApiError } from "@/services/api";

interface PeriodsTableProps {
  periods: PeriodSummary[];
  loading: boolean;
  onSelect: (period: string, type: string) => void;
  onDeleted: () => void;
}

export function PeriodsTable({ periods, loading, onSelect, onDeleted }: PeriodsTableProps) {
  const { rateOf } = useExchangeRate();
  const [deletingPeriod, setDeletingPeriod] = useState<string | null>(null);
  const [confirmPeriod, setConfirmPeriod] = useState<string | null>(null);

  const [deletingType, setDeletingType] = useState<string | null>(null);

  const handleDelete = async (period: string, type: string) => {
    setDeletingPeriod(period);
    setDeletingType(type);
    setConfirmPeriod(null);
    try {
      await billingService.deletePeriod(period, type);
      toast.success(`Cuotas de ${formatPeriod(period)} eliminadas`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron eliminar las cuotas");
    } finally {
      setDeletingPeriod(null);
      setDeletingType(null);
    }
  };

  if (loading) {
    return <Card className="overflow-hidden"><TableSkeleton rows={4} cols={5} /></Card>;
  }

  if (periods.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="Sin períodos emitidos"
          description="Emite el gasto común del mes con el formulario de arriba."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
              <tr>
                <th className="px-5 py-3 font-medium">Período</th>
                <th className="px-5 py-3 font-medium">Cuotas</th>
                <th className="px-5 py-3 font-medium">Tasa</th>
                <th className="px-5 py-3 font-medium">Total base (REF)</th>
                <th className="px-5 py-3 font-medium">Equiv. Bs (hoy)</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ios-separator">
              {periods.map((p) => {
                // Un lote con cuotas a dos tasas no tiene un único equivalente en Bs.
                const single = p.currencies?.length === 1 ? p.currencies[0] : null;
                const rate = single ? rateOf(single) : null;
                return (
                <tr
                  key={`${p.period}-${p.type}`}
                  onClick={() => onSelect(p.period, p.type)}
                  className="cursor-pointer hover:bg-brand-50/50"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ios-label">{formatPeriod(p.period)}</div>
                    {p.hasSpecial && (
                      <span className="mt-0.5 inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple">
                        + especial
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ios-label">{p.count}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-full bg-ios-fill px-2 py-0.5 text-xs font-medium text-ios-label">
                      {single ? rateLabel(single) : "Mixta"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-ios-label">
                    {formatCurrency(p.total)}
                  </td>
                  <td className="px-5 py-3.5 text-ios-secondary">
                    {rate ? formatBs(p.total, rate.rate) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setConfirmPeriod(`${p.period}|${p.type}`); }}
                      disabled={deletingPeriod === p.period && deletingType === p.type}
                      title="Eliminar cuotas"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-ios-red" />
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmPeriod !== null}
        onClose={() => setConfirmPeriod(null)}
        onConfirm={() => {
          if (confirmPeriod) {
            const [p, t] = confirmPeriod.split("|");
            handleDelete(p, t);
          }
        }}
        title="Eliminar cuotas"
        description={`Se eliminarán todas las cuotas seleccionadas de ${confirmPeriod ? formatPeriod(confirmPeriod.split("|")[0]) : ""}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deletingPeriod !== null}
      />
    </>
  );
}
