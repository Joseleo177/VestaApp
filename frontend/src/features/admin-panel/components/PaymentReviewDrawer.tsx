import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Payment } from "@/types/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { paymentService } from "@/features/payments/services/payment.service";
import { ApiError } from "@/services/api";

interface PaymentReviewDrawerProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function PaymentReviewDrawer({ payment, open, onClose, onResolved }: PaymentReviewDrawerProps) {
  const [action, setAction]   = useState<"confirm" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason]   = useState("");

  if (!payment) return null;

  const handleConfirm = async () => {
    setAction("confirm");
    try {
      await paymentService.confirm(payment.id);
      toast.success("Pago aprobado. Recibo PDF generado.");
      onResolved();
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
    <Drawer open={open} onClose={onClose} title="Validar pago">
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Datos del pago</h3>
          <DetailRow label="Copropietario" value={payment.submittedBy.fullName} />
          <DetailRow label="Propiedad"     value={payment.property.code} />
          <DetailRow label="Monto"         value={formatCurrency(payment.amount)} />
          <DetailRow label="Modalidad"     value={payment.bank} />
          <DetailRow label="Referencia"    value={payment.reference || "—"} />
          <DetailRow label="Fecha de pago" value={formatDate(payment.paymentDate)} />
        </div>

        {rejecting && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del rechazo…"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          {!rejecting ? (
            <>
              <Button variant="success" size="lg" loading={action === "confirm"} onClick={handleConfirm}>
                <CheckCircle2 className="h-5 w-5" /> Aprobar
              </Button>
              <Button variant="danger" size="lg" onClick={() => setRejecting(true)}>
                <XCircle className="h-5 w-5" /> Rechazar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
              <Button variant="danger" size="lg" loading={action === "reject"} onClick={handleReject}>
                Confirmar rechazo
              </Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
