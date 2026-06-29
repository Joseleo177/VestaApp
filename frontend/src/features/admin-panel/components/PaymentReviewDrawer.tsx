import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, User, Building2, Calendar, Hash, Banknote, ArrowRightLeft } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Payment, PaymentCurrency } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { paymentService } from "@/features/payments/services/payment.service";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/cn";

interface PaymentReviewDrawerProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <span className="flex-1 text-sm text-slate-500">{label}</span>
      <span className={cn("text-sm font-semibold text-right", highlight ? "text-indigo-700" : "text-slate-800")}>
        {value}
      </span>
    </div>
  );
}

export function PaymentReviewDrawer({ payment, open, onClose, onResolved }: PaymentReviewDrawerProps) {
  const [action, setAction]       = useState<"confirm" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason]       = useState("");

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

  const isBs = payment.currency === PaymentCurrency.BS;
  const initials = payment.submittedBy.fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Drawer open={open} onClose={onClose} title="Validar pago">
      <div className="space-y-5">

        {/* Cabecera propietario */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{payment.submittedBy.fullName}</p>
            <p className="text-xs text-slate-500">
              {payment.property.code}
              {payment.property.tower ? ` · ${payment.property.tower.name}` : ""}
            </p>
          </div>
        </div>

        {/* Detalle del pago */}
        <div className="rounded-xl border border-slate-200 px-4">
          {payment.charge?.period && (
            <InfoRow icon={Calendar} label="Período" value={formatPeriod(payment.charge.period)} />
          )}
          <InfoRow
            icon={Banknote}
            label="Monto"
            value={formatCurrency(payment.amount)}
            highlight
          />
          {isBs && payment.amountBs && (
            <InfoRow
              icon={ArrowRightLeft}
              label="Monto en Bs"
              value={`Bs. ${Number(payment.amountBs).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
            />
          )}
          {isBs && payment.exchangeRate && (
            <InfoRow
              icon={ArrowRightLeft}
              label="Tasa BCV"
              value={`Bs. ${Number(payment.exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })} / EUR`}
            />
          )}
          <InfoRow icon={Building2} label="Modalidad" value={payment.bank} />
          {payment.reference && (
            <InfoRow icon={Hash} label="Referencia" value={payment.reference} />
          )}
          <InfoRow icon={Calendar} label="Fecha de pago" value={formatDate(payment.paymentDate)} />
        </div>

        {/* Motivo de rechazo */}
        {rejecting && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Motivo del rechazo</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo del rechazo…"
              rows={3}
              className="w-full rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm placeholder-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
          </div>
        )}

        {/* Acciones */}
        {!rejecting ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button variant="success" size="lg" loading={action === "confirm"} onClick={handleConfirm}
              className="justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Aprobar
            </Button>
            <Button variant="danger" size="lg" onClick={() => setRejecting(true)}
              className="justify-center gap-2">
              <XCircle className="h-4 w-4" /> Rechazar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button variant="outline" size="lg" onClick={() => { setRejecting(false); setReason(""); }}
              className="justify-center">
              Cancelar
            </Button>
            <Button variant="danger" size="lg" loading={action === "reject"} onClick={handleReject}
              className="justify-center">
              Confirmar rechazo
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
