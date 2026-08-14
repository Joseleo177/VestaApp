import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Charge, ChargeStatus, ChargeType } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";
import { paymentService } from "@/features/payments/services/payment.service";

interface PeriodChargesModalProps {
  period: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_META: Record<ChargeStatus, { label: string; cls: string }> = {
  [ChargeStatus.PENDING]: { label: "Pendiente", cls: "bg-ios-orange/10 text-ios-orange" },
  [ChargeStatus.PAID]: { label: "Pagada", cls: "bg-ios-green/10 text-ios-green" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada", cls: "bg-ios-fill text-ios-secondary" },
  [ChargeStatus.PARTIAL]: { label: "Parcial", cls: "bg-ios-orange/10 text-ios-orange" },
};

export function PeriodChargesModal({ period, open, onClose }: PeriodChargesModalProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  /** El recibo se pide por su número: es el que cubre esta cuota concreta. */
  const handleDownload = async (charge: Charge) => {
    const cp = charge.confirmedPayment;
    if (!cp?.id || !cp.receiptNumber) return;
    setDownloadingId(charge.id);
    try {
      await paymentService.downloadReceipt(cp.id, cp.receiptNumber);
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setDownloadingId(null);
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
            <thead className="text-xs uppercase tracking-wide text-ios-secondary">
              <tr>
                <th className="py-2 font-medium">Departamento</th>
                <th className="py-2 font-medium">Concepto</th>
                <th className="py-2 font-medium">Deuda</th>
                <th className="py-2 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ios-separator">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5">
                    <div className="font-medium text-ios-label">
                      {c.property?.code ?? "—"}
                    </div>
                    {c.property?.tower && (
                      <div className="text-xs text-ios-secondary">{c.property.tower.name}</div>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="text-ios-label text-xs">{c.description}</div>
                    {c.type === ChargeType.SPECIAL && (
                      <span className="mt-0.5 inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple">
                        Especial
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-ios-label">
                    {formatCurrency(c.amountDue ?? c.amount)}
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <span className="ml-1 text-xs text-ios-red">(mora)</span>
                    )}
                    {c.confirmedPayment && (
                      <div className="mt-0.5 font-mono text-xs text-ios-green">
                        {c.confirmedPayment.reference} · {c.confirmedPayment.bank} · {formatDate(c.confirmedPayment.paymentDate)}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_META[c.status].cls
                      )}
                    >
                      {STATUS_META[c.status].label}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    {c.status === ChargeStatus.PAID ? (
                      c.confirmedPayment?.receiptNumber ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(c)}
                          disabled={downloadingId === c.id}
                          title={`Descargar ${c.confirmedPayment.receiptNumber}`}
                        >
                          {downloadingId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-ios-tertiary">—</span>
                      )
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
