import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";

export interface MoraTarget {
  period: string;
  current: number;
  dueDate?: string;
}

interface Props {
  target: MoraTarget | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * Agrega o corrige la mora por vencimiento de un lote regular, p. ej. si se
 * emitió con mora 0. La mora se decide al confirmar cada pago, así que vale
 * para lo que aún no se pagó; las cuotas pagadas no cambian.
 */
export function MoraDialog({ target, onClose, onDone }: Props) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) setValue(target.current > 0 ? String(target.current) : "");
  }, [target]);

  const amount = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  const changed = valid && Math.round(amount * 100) !== Math.round((target?.current ?? 0) * 100);

  const save = async () => {
    if (!target || !changed) return;
    setSaving(true);
    try {
      const { updated } = await billingService.setPeriodMora(target.period, amount);
      toast.success(
        amount > 0
          ? `${updated} ${updated === 1 ? "cuota lleva" : "cuotas llevan"} ahora mora de ${formatCurrency(amount)}`
          : `Se quitó la mora a ${updated} ${updated === 1 ? "cuota" : "cuotas"}`
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cambiar la mora");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target?.current ? "Cambiar mora" : "Agregar mora"}
      description={target ? `Todas las cuotas no pagadas de ${formatPeriod(target.period)}` : undefined}
      icon={
        <ModalIcon tone="bg-red-500/[0.12] text-red-600 dark:text-red-400">
          <Percent className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <div className="space-y-4">
        <Input
          id="moraAmount"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          label="Mora por vencimiento (divisas)"
          placeholder="5.00"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <div className="space-y-1.5 rounded-2xl bg-ios-fill/60 px-4 py-3 text-[13px] text-ios-secondary">
          <p>
            Hoy {target?.current ? (
              <>la mora es de <span className="font-semibold text-ios-label">{formatCurrency(target.current)}</span></>
            ) : (
              <span className="font-semibold text-ios-label">no tiene mora</span>
            )}
            {changed && (
              <>
                {" "}→ pasará a <span className="font-semibold text-ios-label">{formatCurrency(amount)}</span>
              </>
            )}
            .
          </p>
          <p>
            Se cobra a quien pague en bolívares después del vencimiento
            {target?.dueDate ? ` (${formatDate(target.dueDate)})` : ""}; pagando en divisas se anula.
          </p>
          <p>Las cuotas ya pagadas y los pagos ya confirmados no cambian.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={!changed}>
            Guardar mora
          </Button>
        </div>
      </div>
    </Modal>
  );
}
