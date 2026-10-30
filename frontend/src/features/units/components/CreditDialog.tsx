import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";
import { ApiError } from "@/services/api";
import { userService } from "@/features/users/services/user.service";
import { CreditInfo } from "@/features/users/types";

interface CreditDialogProps {
  /** Titular cuyo saldo se corrige; null cierra el diálogo. */
  owner: { id: string; fullName: string } | null;
  credit: CreditInfo | null;
  onClose: () => void;
  onDone: (updated: CreditInfo) => void;
}

const MIN_REASON = 5;

/**
 * Corregir a mano el saldo a favor de un titular: se escribe el saldo que debe
 * quedar y el porqué. Cada ajuste queda registrado y se listan los últimos.
 */
export function CreditDialog({ owner, credit, onClose, onDone }: CreditDialogProps) {
  const [balance, setBalance] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setBalance(credit ? String(credit.creditBalance) : "");
    setReason("");
  }, [owner, credit]);

  const current = credit?.creditBalance ?? 0;
  const target = balance.trim() === "" ? NaN : Math.round(Number(balance) * 100) / 100;
  const delta = Math.round((target - current) * 100) / 100;
  const validAmount = Number.isFinite(target) && target >= 0 && delta !== 0;
  const valid = validAmount && reason.trim().length >= MIN_REASON;

  const submit = async () => {
    if (!owner || !valid) return;
    setSaving(true);
    try {
      const updated = await userService.setCredit(owner.id, target, reason.trim());
      toast.success(`Saldo a favor ajustado a ${formatCurrency(updated.creditBalance)}`);
      onDone(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo ajustar el saldo a favor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={owner !== null} onClose={onClose} title="Ajustar saldo a favor" description={owner?.fullName}>
      {owner && (
        <div className="space-y-4">
          <div className="flex justify-between rounded-2xl bg-ios-fill p-4 text-sm">
            <span className="text-ios-secondary">Saldo actual</span>
            <span className="font-semibold text-ios-label">{formatCurrency(current)}</span>
          </div>

          <div className="space-y-1">
            <Input
              id="creditBalance"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              label="Nuevo saldo (divisas)"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            {Number.isFinite(target) && delta !== 0 && target >= 0 && (
              <p className="text-xs text-ios-secondary">
                {delta > 0 ? `Suma ${formatCurrency(delta)}` : `Quita ${formatCurrency(-delta)}`} al saldo.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="creditReason" className="text-xs font-medium text-ios-label">
              Motivo
            </label>
            <textarea
              id="creditReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Saldo arrastrado del sistema anterior"
              rows={3}
              className="w-full rounded-xl border-0 bg-ios-fill px-3.5 py-2.5 text-[15px] placeholder:text-ios-tertiary focus:outline-none focus:ring-2 focus:ring-brand-600/60"
            />
            {reason.length > 0 && reason.trim().length < MIN_REASON && (
              <p className="text-xs text-ios-red">Escribe al menos {MIN_REASON} caracteres</p>
            )}
          </div>

          {credit && credit.adjustments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ios-label">Últimos ajustes</p>
              <ul className="divide-y divide-ios-separator rounded-xl border border-ios-separator text-[12px]">
                {credit.adjustments.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 text-ios-secondary">
                      <span className="block truncate text-ios-label">{a.reason}</span>
                      {formatDate(a.createdAt)}
                      {a.createdBy && ` · ${a.createdBy}`}
                    </span>
                    <span className={a.amount > 0 ? "shrink-0 text-ios-green" : "shrink-0 text-ios-red"}>
                      {a.amount > 0 ? "+" : "–"}
                      {formatCurrency(Math.abs(a.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
