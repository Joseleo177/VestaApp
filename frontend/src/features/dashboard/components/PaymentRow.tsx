import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { Money } from "@/components/ui/Money";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { paymentBreakdown } from "@/features/payments/components/PaymentBreakdown";
import { chargeLabelFull, coveredCharges } from "@/features/payments/coveredCharges";

// Confirmado es lo normal: gris con su visto. En revisión es una espera, no una
// alarma; el rojo queda para el rechazo, que sí pide hacer algo.
export const PAYMENT_STATUS: Record<PaymentStatus, StatusDef> = {
  [PaymentStatus.CONFIRMED]: { label: "Confirmado", tone: "success", quiet: "check" },
  [PaymentStatus.PENDING]: { label: "En revisión", tone: "info" },
  [PaymentStatus.REJECTED]: { label: "Rechazado", tone: "danger" },
};

/** "Julio de 2026" si pagó una cuota; "3 cuotas" si pagó varias. */
function paymentTitle(pay: Payment): string {
  const charges = coveredCharges(pay);
  if (charges.length === 0) return "Abono a tu cuenta";
  if (charges.length === 1) return formatPeriod(charges[0].period);
  return `${charges.length} cuotas`;
}

const bsAmount = (n: number) =>
  `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Un pago en una línea: qué pagó, cuándo y cómo, y cuánto. El reparto entre
 * cuotas y el saldo a favor quedan plegados: casi nunca se miran, y desplegados
 * en cada fila convertían el historial en un muro de texto.
 */
export function PaymentRow({ payment: pay, multiUnit }: { payment: Payment; multiUnit: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { lines, credit } = paymentBreakdown(pay);
  // Sin registro de aplicaciones (pagos viejos o en revisión), las cuotas elegidas.
  const items = lines.length
    ? lines.map((l) => ({ id: l.charge.id, label: chargeLabelFull(l.charge), amount: l.amount as number | null }))
    : coveredCharges(pay).map((c) => ({ id: c.id, label: chargeLabelFull(c), amount: null }));
  const units = [...new Set(coveredCharges(pay).map((c) => c.property?.code ?? pay.property?.code).filter(Boolean))];
  const byOther = pay.submittedBy && pay.submittedBy.id !== user?.id;
  const rejected = pay.status === PaymentStatus.REJECTED;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ios-fill/50 focus:outline-none focus-visible:bg-ios-fill/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[14px] font-semibold leading-tight text-ios-label">{paymentTitle(pay)}</p>
            <Money value={formatCurrency(pay.amount)} className="shrink-0 text-[15px] font-semibold text-ios-label" />
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <p className="truncate text-[12px] tabular-nums text-ios-secondary">
              {[formatDate(pay.paymentDate), multiUnit && units.join(", "), pay.bank].filter(Boolean).join(" · ")}
            </p>
            <StatusMark {...PAYMENT_STATUS[pay.status]} className="shrink-0" />
          </div>
          {rejected && pay.rejectReason && !open && (
            <p className="mt-1 truncate text-[12px] text-red-600 dark:text-red-400">{pay.rejectReason}</p>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ios-tertiary transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-5 pb-4">
          <dl className="space-y-2 rounded-xl bg-ios-fill/60 px-4 py-3 text-[13px]">
            {rejected && pay.rejectReason && (
              <div className="rounded-lg bg-red-500/[0.08] px-3 py-2 text-red-700 dark:text-red-300">
                <span className="font-semibold">Motivo del rechazo:</span> {pay.rejectReason}
              </div>
            )}
            {items.length > 0 && (
              <div>
                <dt className="mb-1 text-[12px] text-ios-secondary">
                  {pay.status === PaymentStatus.CONFIRMED ? "Se aplicó a" : "Cuotas que paga"}
                </dt>
                <dd>
                  <ul className="space-y-1">
                    {items.map((it) => (
                      <li key={it.id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-ios-label" title={it.label}>
                          {it.label}
                        </span>
                        {it.amount !== null && (
                          <Money value={formatCurrency(it.amount)} className="shrink-0 font-medium text-ios-label" />
                        )}
                      </li>
                    ))}
                    {credit > 0 && (
                      <li className="flex justify-between gap-3">
                        <span className="text-violet-700 dark:text-violet-300">Saldo a favor</span>
                        <Money
                          value={formatCurrency(credit)}
                          className="shrink-0 font-medium text-violet-700 dark:text-violet-300"
                        />
                      </li>
                    )}
                  </ul>
                </dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-ios-separator pt-2 text-[12px] text-ios-secondary">
              {pay.reference && <span>Referencia: <span className="tabular-nums text-ios-label">{pay.reference}</span></span>}
              {pay.currency === PaymentCurrency.BS && pay.amountBs ? (
                <span>Pagado: <span className="tabular-nums text-ios-label">{bsAmount(Number(pay.amountBs))}</span></span>
              ) : (
                <span>Pagado en divisas</span>
              )}
              {byOther && <span>Registró: <span className="text-ios-label">{pay.submittedBy.fullName}</span></span>}
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}
