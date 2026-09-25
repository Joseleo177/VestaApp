import { Charge, Payment } from "@/types/domain";
import { formatPeriod } from "@/lib/format";

/**
 * Cuotas de un pago, la suya primero:
 * - confirmado: las que realmente abonó (incluida la cascada del excedente);
 * - en revisión: las que el vecino eligió pagar;
 * - pagos antiguos: la suya y las de sus recibos.
 */
export function coveredCharges(payment: Payment): Charge[] {
  const fromApps = payment.applications?.map((a) => a.charge) ?? [];
  const fromTargets = [...(payment.targets ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((t) => t.charge);
  const fromReceipts = (payment.receipts ?? []).map((r) => r.charge);
  const source = fromApps.length ? fromApps : fromTargets.length ? fromTargets : fromReceipts;

  const all = [payment.charge, ...source].filter((c): c is Charge => !!c);
  const seen = new Set<string>();
  return all.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** "Apt 4B · Junio 2026" (sin departamento si no viene cargado). */
export function chargeLabel(c: Charge): string {
  return c.property?.code ? `${c.property.code} · ${formatPeriod(c.period)}` : formatPeriod(c.period);
}
