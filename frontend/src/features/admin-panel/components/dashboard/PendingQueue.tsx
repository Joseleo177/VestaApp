import { Payment } from "@/types/domain";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { formatCurrency, formatDate } from "@/lib/format";
import { daysPastDue } from "@/features/dashboard/dueDays";

/** "hoy", "ayer", "hace 3 días": cuánto lleva esperando el vecino. */
export function relativeDay(iso: string): string {
  const d = daysPastDue(iso);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return formatDate(iso);
}

/**
 * Cola de validación en el panel: una línea por pago y "Revisar" para abrirlo.
 * Solo se muestra cuando hay algo: una caja vacía enorme no le dice nada a nadie.
 */
export function PendingQueue({
  payments,
  onReview,
  nameOf,
}: {
  payments: Payment[];
  onReview: (p: Payment) => void;
  nameOf: (p: Payment) => string;
}) {
  return (
    <Card id="por-validar" className="scroll-mt-24 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ios-separator px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ios-label">Pagos por validar</h2>
        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          {payments.length}
        </span>
        <p className="ml-auto hidden text-[12px] text-ios-secondary sm:block">Los más antiguos primero</p>
      </div>
      <ul className="divide-y divide-ios-separator">
        {[...payments]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((p) => {
            const who = nameOf(p);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={who} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ios-label">
                    {who}
                    {p.property?.code && <span className="font-normal text-ios-secondary"> · {p.property.code}</span>}
                  </p>
                  <p className="truncate text-[12px] text-ios-secondary">
                    {[`Reportado ${relativeDay(p.createdAt)}`, p.bank, p.reference && `Ref. ${p.reference}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Money value={formatCurrency(p.amount)} className="shrink-0 text-[14px] font-semibold text-ios-label" />
                <Button size="sm" onClick={() => onReview(p)} className="shrink-0">
                  Revisar
                </Button>
              </li>
            );
          })}
      </ul>
    </Card>
  );
}
