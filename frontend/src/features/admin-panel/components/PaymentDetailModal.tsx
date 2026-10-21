import { ElementType, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Hash,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { StatusMark } from "@/components/ui/StatusMark";
import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { paymentService } from "@/features/payments/services/payment.service";
import { ApiError } from "@/services/api";
import { chargeLabelFull, coveredCharges } from "@/features/payments/coveredCharges";
import { paymentBreakdown } from "@/features/payments/components/PaymentBreakdown";
import { ADMIN_PAYMENT_STATUS } from "@/features/payments/components/PaymentsTable";
import { useSettledGuard } from "@/features/payments/hooks/useSettledGuard";

interface PaymentDetailModalProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
  /** Titular del departamento; si falta, quien registró el pago. */
  ownerName?: string;
  /** Si se pasa, la ficha ofrece eliminar el pago (la página decide si se anula). */
  onDelete?: (payment: Payment) => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-ios-separator py-2.5 last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-ios-tertiary" />
      <span className="flex-1 text-[13px] text-ios-secondary">{label}</span>
      <span className="text-right text-[13px] font-semibold tabular-nums text-ios-label">{value}</span>
    </div>
  );
}

const bs = (n: number) => `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Ficha de un pago, flotante y centrada (hoja desde abajo en el teléfono). En
 * escritorio va en dos columnas: a la izquierda el qué —cuánto y a qué cuotas—,
 * a la derecha el cómo —datos del pago— y lo que se puede hacer con él.
 */
export function PaymentDetailModal({ payment, open, onClose, onResolved, ownerName, onDelete }: PaymentDetailModalProps) {
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const { guard, dialog: settledDialog } = useSettledGuard();

  // Cambiar de pago con el motivo a medio escribir no debe arrastrarlo al siguiente.
  useEffect(() => {
    setRejecting(false);
    setReason("");
  }, [payment?.id]);

  if (!payment) return null;

  const pending = payment.status === PaymentStatus.PENDING;
  const who = ownerName ?? payment.submittedBy?.fullName ?? "Vecino";
  const isBs = payment.currency === PaymentCurrency.BS;
  const { lines, credit } = paymentBreakdown(payment);
  // Sin registro de aplicaciones (en revisión o pagos viejos): las cuotas elegidas, sin monto.
  const items = lines.length
    ? lines.map((l) => ({ id: l.charge.id, label: chargeLabelFull(l.charge), amount: l.amount as number | null }))
    : coveredCharges(payment).map((c) => ({ id: c.id, label: chargeLabelFull(c), amount: null }));

  const handleConfirm = async () => {
    setAction("confirm");
    try {
      await guard(
        (allowSettled) => paymentService.confirm(payment.id, allowSettled),
        () => {
          toast.success(`Pago de ${who} aprobado`);
          onResolved();
        }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo aprobar");
    } finally {
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (reason.trim().length < 3) {
      toast.error("Indica un motivo de rechazo");
      return;
    }
    setAction("reject");
    try {
      await paymentService.reject(payment.id, reason.trim());
      toast.success("Pago rechazado");
      setRejecting(false);
      setReason("");
      onResolved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo rechazar");
    } finally {
      setAction(null);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="sm:max-w-3xl"
        title={pending ? "Validar pago" : "Detalle del pago"}
        description={[who, payment.property?.code, payment.property?.tower?.name].filter(Boolean).join(" · ")}
        icon={
          <ModalIcon tone="bg-fuchsia-500/[0.12] text-fuchsia-600 dark:text-fuchsia-400">
            <CreditCard className="h-5 w-5" />
          </ModalIcon>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {/* ── Qué: cuánto y a qué cuotas ── */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-ios-fill/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-medium text-ios-secondary">Monto del pago</p>
                <StatusMark {...ADMIN_PAYMENT_STATUS[payment.status]} />
              </div>
              <Money value={formatCurrency(payment.amount)} className="mt-1 block text-[34px] font-bold leading-tight tracking-tight text-ios-label" />
              <p className="text-[13px] text-ios-secondary">
                {isBs && payment.amountBs ? `${bs(Number(payment.amountBs))} pagados en bolívares` : "Pagado en divisas"}
              </p>
            </div>

            {payment.status === PaymentStatus.REJECTED && payment.rejectReason && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
                <span className="font-semibold">Motivo del rechazo:</span> {payment.rejectReason}
              </div>
            )}

            {items.length > 0 && (
              <section>
                <h3 className="mb-2 text-[12px] font-medium text-ios-secondary">
                  {payment.status === PaymentStatus.CONFIRMED ? "Se aplicó a" : "Cuotas que paga"}
                </h3>
                <ul className="divide-y divide-ios-separator rounded-xl border border-ios-separator">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <span className="min-w-0 text-ios-label">{it.label}</span>
                      {it.amount !== null && (
                        <Money value={formatCurrency(it.amount)} className="shrink-0 font-semibold text-ios-label" />
                      )}
                    </li>
                  ))}
                  {credit > 0 && (
                    <li className="flex items-center justify-between gap-3 bg-violet-500/[0.05] px-4 py-2.5 text-[13px]">
                      <span className="font-medium text-violet-700 dark:text-violet-300">Saldo a favor</span>
                      <Money value={formatCurrency(credit)} className="shrink-0 font-semibold text-violet-700 dark:text-violet-300" />
                    </li>
                  )}
                </ul>
              </section>
            )}
          </div>

          {/* ── Cómo: datos del pago y acciones ── */}
          <div className="flex flex-col gap-4">
            <section>
              <h3 className="mb-2 text-[12px] font-medium text-ios-secondary">Datos del pago</h3>
              <div className="rounded-xl border border-ios-separator px-4">
                <InfoRow icon={Calendar} label="Fecha de pago" value={formatDate(payment.paymentDate)} />
                <InfoRow icon={Building2} label="Modalidad" value={payment.bank} />
                {payment.reference && <InfoRow icon={Hash} label="Referencia" value={payment.reference} />}
                {isBs && payment.exchangeRate && (
                  <InfoRow
                    icon={ArrowRightLeft}
                    label="Tasa BCV"
                    value={`${Number(payment.exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Bs/${payment.rateCurrency ?? "EUR"}`}
                  />
                )}
                {payment.submittedBy && (
                  <InfoRow icon={UserRound} label="Registrado por" value={payment.submittedBy.fullName} />
                )}
                {payment.reviewedAt && !pending && (
                  <InfoRow
                    icon={payment.status === PaymentStatus.CONFIRMED ? CheckCircle2 : XCircle}
                    label={payment.status === PaymentStatus.CONFIRMED ? "Confirmado el" : "Rechazado el"}
                    value={formatDate(payment.reviewedAt)}
                  />
                )}
              </div>
            </section>

            {rejecting && (
              <div className="space-y-1.5">
                <label htmlFor="reject-reason" className="text-[13px] font-medium text-ios-label">
                  Motivo del rechazo
                </label>
                <textarea
                  id="reject-reason"
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. La referencia no aparece en el banco"
                  rows={3}
                  className="w-full resize-none rounded-xl border-0 bg-red-500/[0.07] px-3.5 py-2.5 text-[15px] text-ios-label placeholder:text-ios-secondary focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <p className="text-[12px] text-ios-secondary">El vecino lo verá en su historial de pagos.</p>
              </div>
            )}

            {/* Acciones al pie de la columna: en escritorio quedan a la altura de la vista. */}
            <div className="mt-auto space-y-2">
              {pending &&
                (!rejecting ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="success" loading={action === "confirm"} onClick={handleConfirm} className="justify-center">
                      <CheckCircle2 className="h-4 w-4" /> Aprobar
                    </Button>
                    <Button variant="outline" onClick={() => setRejecting(true)} className="justify-center text-red-600 dark:text-red-400">
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejecting(false);
                        setReason("");
                      }}
                      className="justify-center"
                    >
                      Cancelar
                    </Button>
                    <Button variant="danger" loading={action === "reject"} onClick={handleReject} className="justify-center">
                      Confirmar rechazo
                    </Button>
                  </div>
                ))}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(payment)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-500/[0.08] dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar pago
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
      {settledDialog}
    </>
  );
}
