import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Charge, ChargeStatus, ChargeType } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Receipt } from "lucide-react";
import { ApiError } from "@/services/api";
import { billingService } from "@/features/billing/services/billing.service";
import { PropertyWithBalance } from "@/features/admin-panel/types";

interface PropertyChargesModalProps {
  property: PropertyWithBalance | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_META: Record<ChargeStatus, { label: string; cls: string }> = {
  [ChargeStatus.PENDING]:    { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  [ChargeStatus.PAID]:       { label: "Pagada",     cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada",  cls: "bg-slate-100 text-slate-500 ring-slate-400/20" },
  [ChargeStatus.PARTIAL]:    { label: "Parcial",    cls: "bg-orange-50 text-orange-700 ring-orange-600/20" },
};

export function PropertyChargesModal({ property, open, onClose }: PropertyChargesModalProps) {
  const [charges, setCharges]         = useState<Charge[]>([]);
  const [loading, setLoading]         = useState(false);
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);

  useEffect(() => {
    if (!open || !property) return;
    setLoading(true);
    billingService
      .listForProperty(property.id)
      .then(setCharges)
      .catch(() => toast.error("No se pudieron cargar las cuotas"))
      .finally(() => setLoading(false));
  }, [open, property]);

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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await billingService.deleteCharge(deleteTarget.id);
      setCharges((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Cuota eliminada");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  const title = property
    ? `Cuotas — ${property.code}${property.tower ? ` · ${property.tower.name}` : ""}`
    : "Cuotas";

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} className="max-w-3xl">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : charges.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="Sin cuotas"
            description="Este departamento no tiene cuotas emitidas aún."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <tr>
                <th className="pb-2 font-medium">Período</th>
                <th className="pb-2 font-medium">Monto</th>
                <th className="pb-2 font-medium whitespace-nowrap">Vence</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {charges.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  {/* Período + concepto */}
                  <td className="py-3 pr-4">
                    <div className="whitespace-nowrap font-medium text-slate-800">
                      {formatPeriod(c.period)}
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[140px]">{c.description}</div>
                    {c.type === ChargeType.SPECIAL && (
                      <span className="mt-0.5 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 ring-1 ring-inset ring-violet-500/20">
                        Especial
                      </span>
                    )}
                  </td>

                  {/* Monto */}
                  <td className="py-3 pr-4 font-semibold text-slate-700 whitespace-nowrap">
                    {c.status === ChargeStatus.PAID
                      ? formatCurrency(c.amountPaid ?? c.amount)
                      : formatCurrency(c.amountDue ?? c.amount)}
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <div className="text-xs font-normal text-rose-500">mora incluida</div>
                    )}
                    {c.status === ChargeStatus.PARTIAL && (c.amountPaid ?? 0) > 0 && (
                      <div className="text-xs font-normal text-orange-500">
                        pagado {formatCurrency(c.amountPaid ?? 0)}
                      </div>
                    )}
                    {c.confirmedPayment && (
                      <div className="mt-0.5 font-mono text-xs text-emerald-600 whitespace-nowrap">
                        {c.confirmedPayment.reference} · {c.confirmedPayment.bank}
                        <br />{formatDate(c.confirmedPayment.paymentDate)}
                      </div>
                    )}
                  </td>

                  {/* Vence */}
                  <td className="py-3 pr-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(c.dueDate)}
                  </td>

                  {/* Estado */}
                  <td className="py-3 pr-4">
                    <span className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
                      STATUS_META[c.status].cls
                    )}>
                      {STATUS_META[c.status].label}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="py-3">
                    <div className="flex justify-end items-center gap-1">
                      {c.status !== ChargeStatus.PAID && c.status !== ChargeStatus.PARTIAL && (
                        <Button
                          size="sm"
                          variant={c.status === ChargeStatus.EXONERATED ? "outline" : "ghost"}
                          onClick={() => toggle(c)}
                          disabled={busyId === c.id}
                        >
                          {c.status === ChargeStatus.EXONERATED ? "Reactivar" : "Exonerar"}
                        </Button>
                      )}
                      {(c.status === ChargeStatus.PENDING || c.status === ChargeStatus.EXONERATED) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(c)}
                          disabled={busyId === c.id}
                          title="Eliminar cuota"
                          className="text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {c.status === ChargeStatus.PAID && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cuota"
        description={`¿Eliminar la cuota de ${deleteTarget ? formatPeriod(deleteTarget.period) : ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={busyId === deleteTarget?.id}
      />
    </>
  );
}
