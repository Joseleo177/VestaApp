import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Charge, ChargeType } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { DatePicker, toISODate } from "@/components/ui/DatePicker";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";

/** La cuota de la lista con lo que cambió al corregir su vencimiento. */
export const mergeDue = (charge: Charge, updated: Charge): Charge => ({
  ...charge,
  dueDate: updated.dueDate,
  overdue: updated.overdue,
  amountDue: updated.amountDue ?? charge.amountDue,
});

export type DueDateTarget =
  | { kind: "charge"; charge: Charge }
  | { kind: "period"; period: string; type: ChargeType; current?: string; moraAmount?: number };

interface Props {
  target: DueDateTarget | null;
  onClose: () => void;
  /** Al corregir una cuota llega la cuota actualizada; al corregir un lote, nada. */
  onDone: (updated?: Charge) => void;
}

/**
 * Corrige el vencimiento. La mora se decide al confirmar cada pago comparando su
 * fecha con este vencimiento: si se cargó mal, quien pagó con mora no cuadraba.
 * Las cuotas ya pagadas no cambian.
 */
export function DueDateDialog({ target, onClose, onDone }: Props) {
  const current = target?.kind === "charge" ? target.charge.dueDate : target?.current;
  const mora = target?.kind === "charge" ? Number(target.charge.moraAmount ?? 0) : Number(target?.moraAmount ?? 0);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) setDate(current?.slice(0, 10) ?? "");
  }, [target, current]);

  const period = target?.kind === "charge" ? target.charge.period : target?.period;
  const changed = !!date && date !== current?.slice(0, 10);
  const today = toISODate(new Date());

  // Atajos dentro del mes de la cuota: lo usual es el 5, el 15 o fin de mes.
  const [y, m] = (period ?? "").split("-").map(Number);
  const last = y && m ? new Date(y, m, 0).getDate() : 0;
  const shortcuts =
    y && m
      ? [
          { label: "Día 5", value: toISODate(new Date(y, m - 1, 5)) },
          { label: "Día 15", value: toISODate(new Date(y, m - 1, 15)) },
          { label: `Fin de mes (${last})`, value: toISODate(new Date(y, m - 1, last)) },
        ]
      : undefined;

  const save = async () => {
    if (!target || !changed) return;
    setSaving(true);
    try {
      if (target.kind === "charge") {
        const updated = await billingService.setChargeDueDate(target.charge.id, date);
        toast.success(`Vencimiento corregido al ${formatDate(date)}`);
        onDone(updated);
      } else {
        const { updated } = await billingService.setPeriodDueDate(target.period, target.type, date);
        toast.success(`${updated} ${updated === 1 ? "cuota vence" : "cuotas vencen"} ahora el ${formatDate(date)}`);
        onDone();
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cambiar el vencimiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title="Cambiar vencimiento"
      description={
        target?.kind === "charge"
          ? `${target.charge.property?.code ?? "Cuota"} · ${formatPeriod(target.charge.period)}`
          : period
            ? `Todas las cuotas no pagadas de ${formatPeriod(period)}`
            : undefined
      }
      icon={
        <ModalIcon tone="bg-amber-500/[0.12] text-amber-600 dark:text-amber-400">
          <CalendarClock className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <div className="space-y-4">
        <DatePicker label="Nuevo vencimiento" value={date} onChange={setDate} shortcuts={shortcuts} />

        <div className="space-y-1.5 rounded-2xl bg-ios-fill/60 px-4 py-3 text-[13px] text-ios-secondary">
          {current && (
            <p>
              Hoy vence el <span className="font-semibold text-ios-label">{formatDate(current)}</span>
              {changed && (
                <>
                  {" "}→ pasará al <span className="font-semibold text-ios-label">{formatDate(date)}</span>
                </>
              )}
              .
            </p>
          )}
          <p>
            Los pagos <span className="font-medium text-ios-label">por confirmar</span> con fecha posterior al vencimiento
            llevarán la mora{mora > 0 ? ` de ${formatCurrency(mora)}` : ""} al pagarse en bolívares.
            {date && date < today && " Con esta fecha la cuota ya queda vencida."}
          </p>
          <p>Las cuotas ya pagadas y los pagos ya confirmados no cambian.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={!changed}>
            Guardar vencimiento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
