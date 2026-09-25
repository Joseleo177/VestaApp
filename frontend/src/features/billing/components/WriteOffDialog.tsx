import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Charge } from "@/types/domain";
import { formatCurrency, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";

interface WriteOffDialogProps {
  /** Cuota parcial a cerrar; null cierra el diálogo. */
  charge: Charge | null;
  onClose: () => void;
  onDone: (updated: Charge) => void;
}

const MIN_REASON = 5;

/**
 * Condonar el saldo de una cuota con abono parcial: p. ej. el vecino pagó 20 de
 * 25 por un error de tasa y se decide no cobrarle los 5 restantes. La cuota
 * queda pagada, con lo condonado y el motivo a la vista, y se emite su recibo.
 */
export function WriteOffDialog({ charge, onClose, onDone }: WriteOffDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (charge) setReason("");
  }, [charge]);

  const remaining = charge ? charge.amountDue ?? 0 : 0;
  const valid = reason.trim().length >= MIN_REASON;

  const submit = async () => {
    if (!charge || !valid) return;
    setSaving(true);
    try {
      const updated = await billingService.writeOff(charge.id, reason.trim());
      toast.success(`Saldo de ${formatCurrency(remaining)} condonado`);
      onDone(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo condonar el saldo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={charge !== null}
      onClose={onClose}
      title={charge ? `Condonar saldo — ${formatPeriod(charge.period)}` : "Condonar saldo"}
    >
      {charge && (
        <div className="space-y-4">
          <div className="space-y-1 rounded-2xl bg-ios-fill p-4 text-sm">
            <p className="mb-1 text-xs text-ios-secondary">{charge.description}</p>
            <div className="flex justify-between">
              <span className="text-ios-secondary">Abonado</span>
              <span className="text-ios-green">{formatCurrency(charge.amountPaid ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-ios-separator pt-2">
              <span className="font-semibold text-ios-label">Saldo a condonar</span>
              <span className="text-lg font-bold text-ios-label">{formatCurrency(remaining)}</span>
            </div>
          </div>

          <p className="text-xs text-ios-secondary">
            La cuota queda pagada y se emite su recibo, donde se ve lo condonado y el motivo. Se
            puede revertir; también se revierte sola si se borra un pago de esta cuota.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="writeOffReason" className="text-xs font-medium text-ios-label">
              Motivo
            </label>
            <textarea
              id="writeOffReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. El vecino calculó la tasa del día anterior"
              rows={3}
              className="w-full rounded-xl border-0 bg-ios-fill px-3.5 py-2.5 text-[15px] placeholder:text-ios-tertiary focus:outline-none focus:ring-2 focus:ring-brand-600/60"
            />
            {!valid && reason.length > 0 && (
              <p className="text-xs text-ios-red">Escribe al menos {MIN_REASON} caracteres</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={onClose} className="w-full justify-center sm:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={() => void submit()}
              loading={saving}
              disabled={!valid}
              className="w-full justify-center sm:w-auto"
            >
              Condonar {formatCurrency(remaining)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
