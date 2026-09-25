import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
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
import { paymentService } from "@/features/payments/services/payment.service";
import { PropertyWithBalance } from "@/features/admin-panel/types";

import { PaymentForm } from "@/features/payments/components/PaymentForm";
import { WriteOffDialog } from "@/features/billing/components/WriteOffDialog";

interface PropertyChargesModalProps {
  property: PropertyWithBalance | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_META: Record<ChargeStatus, { label: string; cls: string }> = {
  [ChargeStatus.PENDING]:    { label: "Pendiente",  cls: "bg-ios-orange/10 text-ios-orange" },
  [ChargeStatus.PAID]:       { label: "Pagada",     cls: "bg-ios-green/10 text-ios-green" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada",  cls: "bg-ios-fill text-ios-secondary" },
  [ChargeStatus.PARTIAL]:    { label: "Parcial",    cls: "bg-ios-orange/10 text-ios-orange" },
};

export function PropertyChargesModal({ property, open, onClose }: PropertyChargesModalProps) {
  const [charges, setCharges]         = useState<Charge[]>([]);
  const [loading, setLoading]         = useState(false);
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Charge | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Charge | null>(null);
  const [writeOffTarget, setWriteOffTarget] = useState<Charge | null>(null);
  const [revertTarget, setRevertTarget] = useState<Charge | null>(null);

  const replaceCharge = (updated: Charge) =>
    setCharges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const handleRevertWriteOff = async () => {
    if (!revertTarget) return;
    setBusyId(revertTarget.id);
    try {
      replaceCharge(await billingService.revertWriteOff(revertTarget.id));
      toast.success("Condonación revertida: la cuota vuelve a parcial");
      setRevertTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo revertir");
    } finally {
      setBusyId(null);
    }
  };

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
      <Modal open={open} onClose={onClose} title={title} className="w-full sm:max-w-2xl">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : charges.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="Sin cuotas"
            description="Este departamento no tiene cuotas emitidas aún."
          />
        ) : (
          /* Lista en vez de tabla: las cuotas caben a cualquier ancho sin
             obligar a desplazar el modal en horizontal. */
          <ul className="divide-y divide-ios-separator text-sm">
            {charges.map((c) => {
              const cp = c.confirmedPayment;
              const receiptNumber = cp?.receiptNumber ?? null;
              const canPay =
                c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;
              const canExonerate =
                c.status === ChargeStatus.PENDING || c.status === ChargeStatus.EXONERATED;
              const canDelete = canExonerate;
              const busy = busyId === c.id;

              return (
                <li key={c.id} className="py-3 first:pt-0">
                  {/* Cabecera: período + estado a la izquierda, monto a la derecha */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-ios-label">
                          {formatPeriod(c.period)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_META[c.status].cls
                          )}
                        >
                          {STATUS_META[c.status].label}
                        </span>
                        {c.type === ChargeType.SPECIAL && (
                          <span className="inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple">
                            Especial
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ios-secondary">
                        {c.description}
                      </p>
                      <p className="mt-0.5 text-xs text-ios-tertiary">
                        Vence {formatDate(c.dueDate)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-ios-label">
                        {c.status === ChargeStatus.PAID
                          ? formatCurrency(c.amountPaid ?? c.amount)
                          : formatCurrency(c.amountDue ?? c.amount)}
                      </div>
                      {c.overdue && c.status === ChargeStatus.PENDING && (
                        <div className="text-xs text-ios-red">mora incluida</div>
                      )}
                      {c.status === ChargeStatus.PARTIAL && (c.amountPaid ?? 0) > 0 && (
                        <div className="text-xs text-ios-orange">
                          pagado {formatCurrency(c.amountPaid ?? 0)}
                        </div>
                      )}
                      {c.writeOff && (
                        <div className="text-xs text-ios-purple">
                          condonado {formatCurrency(c.writeOff.amount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {c.writeOff && (
                    <p className="mt-1.5 break-words text-xs text-ios-purple">
                      Motivo de la condonación: {c.writeOff.reason}
                    </p>
                  )}

                  {/* Datos del pago confirmado */}
                  {cp && (
                    <p className="mt-1.5 break-words font-mono text-xs text-ios-green">
                      {[cp.reference, cp.bank, cp.paymentDate ? formatDate(cp.paymentDate) : null]
                        .filter(Boolean)
                        .join(" · ")}
                      {receiptNumber && (
                        <span className="text-ios-secondary"> · Recibo {receiptNumber}</span>
                      )}
                    </p>
                  )}

                  {/* Acciones: se reacomodan en varias líneas si el ancho aprieta */}
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                    {receiptNumber ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(c)}
                        disabled={downloadingId === c.id}
                        title={`Descargar ${receiptNumber}`}
                      >
                        {downloadingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Recibo
                      </Button>
                    ) : (
                      c.status === ChargeStatus.PAID && (
                        <span className="text-xs text-ios-tertiary">Sin recibo emitido</span>
                      )
                    )}
                    {canPay && (
                      <Button size="sm" variant="ghost" onClick={() => setPaymentTarget(c)}>
                        Registrar pago
                      </Button>
                    )}
                    {c.status === ChargeStatus.PARTIAL && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setWriteOffTarget(c)}
                        disabled={busy || !!c.pendingPayment}
                        title={c.pendingPayment ? "Tiene un pago pendiente de revisión" : "Perdonar el saldo restante"}
                      >
                        Condonar saldo
                      </Button>
                    )}
                    {c.writeOff && (
                      <Button size="sm" variant="ghost" onClick={() => setRevertTarget(c)} disabled={busy}>
                        Revertir condonación
                      </Button>
                    )}
                    {canExonerate && (
                      <Button
                        size="sm"
                        variant={c.status === ChargeStatus.EXONERATED ? "outline" : "ghost"}
                        onClick={() => toggle(c)}
                        disabled={busy}
                      >
                        {c.status === ChargeStatus.EXONERATED ? "Reactivar" : "Exonerar"}
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(c)}
                        disabled={busy}
                        title="Eliminar cuota"
                        className="text-ios-red hover:bg-ios-red/10 hover:text-ios-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <WriteOffDialog
        charge={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
        onDone={(updated) => {
          replaceCharge(updated);
          setWriteOffTarget(null);
        }}
      />

      <ConfirmDialog
        open={revertTarget !== null}
        onClose={() => setRevertTarget(null)}
        onConfirm={() => void handleRevertWriteOff()}
        title="Revertir condonación"
        description={`La cuota de ${revertTarget ? formatPeriod(revertTarget.period) : ""} vuelve a quedar parcial con ${revertTarget?.writeOff ? formatCurrency(revertTarget.writeOff.amount) : ""} pendiente, y se anula el recibo emitido al condonar.`}
        confirmLabel="Revertir"
        loading={busyId === revertTarget?.id}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cuota"
        description={`¿Eliminar la cuota de ${deleteTarget ? formatPeriod(deleteTarget.period) : ""}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={busyId === deleteTarget?.id}
      />

      <Modal
        open={paymentTarget !== null}
        onClose={() => setPaymentTarget(null)}
        title={`Registrar pago — ${paymentTarget ? formatPeriod(paymentTarget.period) : ""}`}
      >
        {paymentTarget && (
          <PaymentForm
            charges={[paymentTarget]}
            defaultChargeId={paymentTarget.id}
            onSuccess={() => {
              setPaymentTarget(null);
              if (property) {
                setLoading(true);
                billingService
                  .listForProperty(property.id)
                  .then(setCharges)
                  .finally(() => setLoading(false));
              }
            }}
            onCancel={() => setPaymentTarget(null)}
          />
        )}
      </Modal>
    </>
  );
}
