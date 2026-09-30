import { Payment } from "@/types/domain";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { chargeLabel } from "../coveredCharges";

/**
 * A qué cuotas fue el dinero de un pago confirmado y cuánto a cada una, más lo
 * que quedó como saldo a favor. Sale del registro de aplicaciones, así que los
 * pagos anteriores a ese registro no lo tienen.
 */
export function paymentBreakdown(payment: Payment) {
  const lines = (payment.applications ?? [])
    .filter((a) => a.charge)
    .map((a) => ({ charge: a.charge, amount: Number(a.amount) }))
    // La cuota del pago primero; luego la cascada, de la más antigua a la más nueva.
    .sort(
      (a, b) =>
        Number(b.charge.id === payment.charge?.id) - Number(a.charge.id === payment.charge?.id) ||
        String(a.charge.dueDate).localeCompare(String(b.charge.dueDate))
    );
  const credit = Number(payment.creditAmount ?? 0);
  return { lines, credit: credit > 0 ? credit : 0 };
}

/**
 * Solo vale la pena mostrarlo si dice algo que el monto del pago no dice: que
 * se repartió entre varias cuotas, que la cuota absorbió menos que el pago, o
 * que sobró saldo a favor.
 */
export function hasInformativeBreakdown(payment: Payment): boolean {
  const { lines, credit } = paymentBreakdown(payment);
  if (lines.length === 0) return false;
  return (
    lines.length > 1 ||
    credit > 0 ||
    Math.abs(lines[0]!.amount - Number(payment.amount)) > 0.005
  );
}

export function PaymentBreakdown({
  payment,
  className,
}: {
  payment: Payment;
  className?: string;
}) {
  if (!hasInformativeBreakdown(payment)) return null;
  const { lines, credit } = paymentBreakdown(payment);

  return (
    <ul className={cn("mt-1 space-y-0.5 text-xs", className)}>
      {lines.map(({ charge, amount }) => (
        <li key={charge.id} className="flex justify-between gap-3 text-ios-green">
          <span className="truncate">→ {chargeLabel(charge)}</span>
          <span className="shrink-0 font-medium tabular-nums">{formatCurrency(amount)}</span>
        </li>
      ))}
      {credit > 0 && (
        <li className="flex justify-between gap-3 text-ios-purple">
          <span>→ Saldo a favor</span>
          <span className="shrink-0 font-medium tabular-nums">{formatCurrency(credit)}</span>
        </li>
      )}
    </ul>
  );
}
