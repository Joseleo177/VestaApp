import { useState } from "react";
import { Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBs, formatCurrency, formatPeriod } from "@/lib/format";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { PeriodSummary, billingService } from "../services/billing.service";
import { ApiError } from "@/services/api";

interface PeriodsTableProps {
  periods: PeriodSummary[];
  loading: boolean;
  onSelect: (period: string) => void;
  onDeleted: () => void;
}

export function PeriodsTable({ periods, loading, onSelect, onDeleted }: PeriodsTableProps) {
  const { data: rate } = useExchangeRate();
  const [deletingPeriod, setDeletingPeriod] = useState<string | null>(null);
  const [confirmPeriod, setConfirmPeriod] = useState<string | null>(null);

  const handleDelete = async (period: string) => {
    setDeletingPeriod(period);
    setConfirmPeriod(null);
    try {
      await billingService.deletePeriod(period);
      toast.success(`Cuotas de ${formatPeriod(period)} eliminadas`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron eliminar las cuotas");
    } finally {
      setDeletingPeriod(null);
    }
  };

  if (loading) {
    return <Card className="overflow-hidden"><TableSkeleton rows={4} cols={4} /></Card>;
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
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Período</th>
                <th className="px-5 py-3 font-medium">Cuotas</th>
                <th className="px-5 py-3 font-medium">Total base (€)</th>
                <th className="px-5 py-3 font-medium">Equiv. Bs (hoy)</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((p) => (
                <tr
                  key={p.period}
                  onClick={() => onSelect(p.period)}
                  className="cursor-pointer hover:bg-brand-50/50"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{formatPeriod(p.period)}</div>
                    {p.hasSpecial && (
                      <span className="mt-0.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 ring-1 ring-inset ring-violet-500/20">
                        + especial
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{p.count}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">
                    {formatCurrency(p.total)}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {rate ? formatBs(p.total, rate.rate) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setConfirmPeriod(p.period); }}
                      disabled={deletingPeriod === p.period}
                      title="Eliminar período"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmPeriod !== null}
        onClose={() => setConfirmPeriod(null)}
        onConfirm={() => confirmPeriod && handleDelete(confirmPeriod)}
        title="Eliminar período"
        description={`Se eliminarán todas las cuotas de ${confirmPeriod ? formatPeriod(confirmPeriod) : ""}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deletingPeriod !== null}
      />
    </>
  );
}
