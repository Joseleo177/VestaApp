import { Charge, ChargeStatus } from "@/types/domain";

const DAY = 86_400_000;

/** Medianoche local de una fecha "YYYY-MM-DD" (o ISO): sin el desfase de UTC. */
const midnight = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
};

/**
 * Días desde el vencimiento: positivo si ya venció, 0 si vence hoy, negativo si
 * faltan días. `new Date("2026-10-20")` es medianoche UTC, que en Venezuela es
 * la tarde del día anterior; por eso se arma la fecha a mano.
 */
export function daysPastDue(dueDate: string, today = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((t - midnight(dueDate)) / DAY);
}

/** Cuota con saldo abierto (pendiente o abonada a medias). */
export const isOpenCharge = (c: Charge) =>
  c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;

/** Lo que falta por pagar de la cuota, mora incluida si ya venció. */
export const dueAmount = (c: Charge) => Number(c.amountDue ?? c.amount);
