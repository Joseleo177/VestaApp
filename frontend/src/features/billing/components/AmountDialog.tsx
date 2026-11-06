import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { Charge, ChargeType } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { formatCurrency, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";

/** La cuota de la lista con lo que cambió al corregir su monto. */
export const mergeAmount = (charge: Charge, updated: Charge): Charge => ({
  ...charge,
  amount: updated.amount,
  bsPrice: updated.bsPrice ?? null,
  amountDue: updated.amountDue ?? charge.amountDue,
  amountDueDivisas: updated.amountDueDivisas ?? charge.amountDueDivisas,
});

export type AmountTarget =
  | { kind: "charge"; charge: Charge }
  | { kind: "period"; period: string; type: ChargeType; amount?: number; bsPrice?: number | null; currency?: string | null };

interface Props {
  target: AmountTarget | null;
  onClose: () => void;
  /** Al corregir una cuota llega la cuota actualizada; al corregir un lote, nada. */
  onDone: (updated?: Charge) => void;
}

const parse = (s: string) => (s.trim() === "" ? null : Math.round(Number(s) * 100) / 100);

/**
 * Corrige el monto de cuotas emitidas con una cifra equivocada, sin anularlas y
 * volver a crearlas. Solo las no pagadas; una con abono no puede quedar por
 * debajo de lo abonado.
 */
export function AmountDialog({ target, onClose, onDone }: Props) {
  const currentAmount = target?.kind === "charge" ? target.charge.amount : target?.amount;
  // Moneda de la cuota (o del lote): con ella se muestran los montos.
  const cur = target?.kind === "charge" ? target.charge.currency : target?.currency;
  const currentBs = target?.kind === "charge" ? target.charge.bsPrice ?? null : target?.bsPrice ?? null;
  const [amount, setAmount] = useState("");
  const [bsPrice, setBsPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAmount(currentAmount != null ? String(currentAmount) : "");
    setBsPrice(currentBs != null ? String(currentBs) : "");
  }, [target, currentAmount, currentBs]);

  const nextAmount = parse(amount);
  const nextBsRaw = parse(bsPrice);
  // Igual al monto: cuesta lo mismo en cualquier moneda.
  const nextBs = nextBsRaw !== null && nextBsRaw !== nextAmount ? nextBsRaw : null;
  const validAmount = nextAmount !== null && Number.isFinite(nextAmount) && nextAmount > 0;
  const validBs = nextBsRaw === null || (Number.isFinite(nextBsRaw) && nextBsRaw > 0);
  const changed = nextAmount !== (currentAmount ?? null) || nextBs !== (currentBs ?? null);
  const paid = target?.kind === "charge" ? Number(target.charge.amountPaid ?? 0) : 0;

  const save = async () => {
    if (!target || !validAmount || !validBs || !changed || nextAmount === null) return;
    setSaving(true);
    try {
      if (target.kind === "charge") {
        const updated = await billingService.setChargeAmount(target.charge.id, nextAmount, nextBs);
        toast.success(`Monto corregido a ${formatCurrency(nextAmount, cur)}`);
        onDone(updated);
      } else {
        const { updated } = await billingService.setPeriodAmount(target.period, target.type, nextAmount, nextBs);
        toast.success(`${updated} ${updated === 1 ? "cuota queda" : "cuotas quedan"} en ${formatCurrency(nextAmount, cur)}`);
        onDone();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo corregir el monto");
    } finally {
      setSaving(false);
    }
  };

  const period = target?.kind === "charge" ? target.charge.period : target?.period;

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Corregir monto"
      description={
        target?.kind === "charge"
          ? `${target.charge.property?.code ?? "Cuota"} · ${formatPeriod(target.charge.period)}`
          : period
            ? `Todas las cuotas no pagadas de ${formatPeriod(period)}`
            : undefined
      }
      icon={
        <ModalIcon tone="bg-amber-500/[0.12] text-amber-600 dark:text-amber-400">
          <Coins className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="fixAmount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            label="Monto (divisas)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== "" && !validAmount ? "Debe ser mayor a cero" : undefined}
          />
          <Input
            id="fixBsPrice"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            label="Si pagan en Bs (opcional)"
            placeholder={nextAmount ? `Igual: ${nextAmount}` : "Igual al monto"}
            value={bsPrice}
            onChange={(e) => setBsPrice(e.target.value)}
            error={!validBs ? "Debe ser mayor a cero" : undefined}
          />
        </div>

        <div className="space-y-1.5 rounded-2xl bg-ios-fill/60 px-4 py-3 text-[13px] text-ios-secondary">
          {currentAmount != null && (
            <p>
              Hoy es de <span className="font-semibold text-ios-label">{formatCurrency(currentAmount, cur)}</span>
              {currentBs != null && ` (${formatCurrency(currentBs, cur)} en Bs)`}
              {changed && validAmount && nextAmount !== null && (
                <>
                  {" "}→ quedará en <span className="font-semibold text-ios-label">{formatCurrency(nextAmount, cur)}</span>
                  {nextBs !== null && ` (${formatCurrency(nextBs, cur)} en Bs)`}
                </>
              )}
              .
            </p>
          )}
          {paid > 0 && <p>Ya tiene abonado {formatCurrency(paid, cur)}: el monto nuevo debe ser mayor.</p>}
          <p>Las cuotas ya pagadas no cambian.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={!validAmount || !validBs || !changed}>
            Guardar monto
          </Button>
        </div>
      </div>
    </Modal>
  );
}
