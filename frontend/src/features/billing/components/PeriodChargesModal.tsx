import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Charge, ChargeStatus, ChargeType } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";

interface PeriodChargesModalProps {
  period: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_META: Record<ChargeStatus, { label: string; cls: string }> = {
  [ChargeStatus.PENDING]: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  [ChargeStatus.PAID]: { label: "Pagada", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada", cls: "bg-slate-100 text-slate-500 ring-slate-400/20" },
  [ChargeStatus.PARTIAL]: { label: "Parcial", cls: "bg-orange-50 text-orange-700 ring-orange-600/20" },
};

export function PeriodChargesModal({ period, open, onClose }: PeriodChargesModalProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !period) return;
    setLoading(true);
    billingService
      .listForPeriod(period)
      .then(setCharges)
      .catch(() => toast.error("No se pudieron cargar las cuotas"))
      .finally(() => setLoading(false));
  }, [open, period]);

  const toggle = async (charge: Charge) => {
    const exonerate = charge.status !== ChargeStatus.EXONERATED;
    setBusyId(charge.id);
    try {
      const updated = await billingService.setExonerated(charge.id, exonerate);
      setCharges((prev) => prev.map((c) => (c.id === charge.id ? updated : c)));
      toast.success(exonerate ? "Cuota exonerada" : "Cuota reactivada");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={period ? `Cuotas — ${formatPeriod(period)}` : "Cuotas"}
      className="max-w-2xl"
    >
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 font-medium">Departamento</th>
                <th className="py-2 font-medium">Concepto</th>
                <th className="py-2 font-medium">Deuda</th>
                <th className="py-2 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5">
                    <div className="font-medium text-slate-800">
                      {c.property?.code ?? "—"}
                    </div>
                    {c.property?.tower && (
                      <div className="text-xs text-slate-400">{c.property.tower.name}</div>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="text-slate-600 text-xs">{c.description}</div>
                    {c.type === ChargeType.SPECIAL && (
                      <span className="mt-0.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 ring-1 ring-inset ring-violet-500/20">
                        Especial
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-slate-600">
                    {formatCurrency(c.amountDue ?? c.amount)}
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <span className="ml-1 text-xs text-rose-500">(mora)</span>
                    )}
                    {c.confirmedPayment && (
                      <div className="mt-0.5 font-mono text-xs text-emerald-600">
                        {c.confirmedPayment.reference} · {c.confirmedPayment.bank} · {formatDate(c.confirmedPayment.paymentDate)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                        STATUS_META[c.status].cls
                      )}
                    >
                      {STATUS_META[c.status].label}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    {c.status === ChargeStatus.PAID ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={c.status === ChargeStatus.EXONERATED ? "outline" : "ghost"}
                        onClick={() => toggle(c)}
                        disabled={busyId === c.id}
                      >
                        {c.status === ChargeStatus.EXONERATED ? "Reactivar" : "Exonerar"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
