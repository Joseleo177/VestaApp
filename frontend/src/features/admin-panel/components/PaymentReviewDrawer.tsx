import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, XCircle } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
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

/**
 * Vista lateral de validación: a la izquierda los datos + comprobante ampliado,
 * abajo dos acciones grandes (Aprobar / Rechazar).
 */
export function PaymentReviewDrawer({
  payment,
  open,
  onClose,
  onResolved,
}: PaymentReviewDrawerProps) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  // Carga el comprobante (con auth) cuando se abre un pago.
  useEffect(() => {
    if (!payment || !open) return;
    let url: string | null = null;
    setLoadingProof(true);
    setRejecting(false);
    setReason("");
    paymentService
      .getProofUrl(payment.id)
      .then((u) => {
        url = u;
        setProofUrl(u);
      })
      .catch(() => toast.error("No se pudo cargar el comprobante"))
      .finally(() => setLoadingProof(false));
    return () => {
      if (url) URL.revokeObjectURL(url);
      setProofUrl(null);
    };
  }, [payment, open]);

  if (!payment) return null;

  const isImage = !payment.proofFilePath.toLowerCase().endsWith(".pdf");

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
        {/* Datos del vecino */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Datos del pago</h3>
          <DetailRow label="Copropietario" value={payment.submittedBy.fullName} />
          <DetailRow label="Propiedad" value={payment.property.code} />
          <DetailRow label="Monto" value={formatCurrency(payment.amount)} />
          <DetailRow label="Banco" value={payment.bank} />
          <DetailRow label="Referencia" value={payment.reference} />
          <DetailRow label="Fecha de pago" value={formatDate(payment.paymentDate)} />
        </div>

        {/* Comprobante ampliado */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Comprobante</h3>
          {loadingProof ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : proofUrl && isImage ? (
            <a href={proofUrl} target="_blank" rel="noreferrer">
              <img
                src={proofUrl}
                alt="Comprobante de pago"
                className="max-h-96 w-full rounded-xl border border-slate-200 object-contain"
              />
            </a>
          ) : proofUrl ? (
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
            >
              <FileText className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-brand-600">Abrir comprobante (PDF)</span>
            </a>
          ) : (
            <p className="text-sm text-slate-400">Comprobante no disponible</p>
          )}
        </div>

        {/* Acciones */}
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
              <Button
                variant="success"
                size="lg"
                loading={action === "confirm"}
                onClick={handleConfirm}
              >
                <CheckCircle2 className="h-5 w-5" /> Aprobar pago
              </Button>
              <Button variant="danger" size="lg" onClick={() => setRejecting(true)}>
                <XCircle className="h-5 w-5" /> Rechazar pago
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="lg"
                loading={action === "reject"}
                onClick={handleReject}
              >
                Confirmar rechazo
              </Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
