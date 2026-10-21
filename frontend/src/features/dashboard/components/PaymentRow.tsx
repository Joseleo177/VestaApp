import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Banknote, ChevronDown, Download } from "lucide-react";
import { Charge, Payment, PaymentCurrency, PaymentStatus, RateCurrency } from "@/types/domain";
import { Money } from "@/components/ui/Money";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate, formatPeriod, formatRate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { paymentBreakdown } from "@/features/payments/components/PaymentBreakdown";
import { chargeLabelFull, coveredCharges } from "@/features/payments/coveredCharges";
import { paymentService } from "@/features/payments/services/payment.service";

// Confirmado es lo normal: gris con su visto. En revisión es una espera, no una
// alarma; el rojo queda para el rechazo, que sí pide hacer algo.
export const PAYMENT_STATUS: Record<PaymentStatus, StatusDef> = {
  [PaymentStatus.CONFIRMED]: { label: "Confirmado", tone: "success", quiet: "check" },
  [PaymentStatus.PENDING]: { label: "En revisión", tone: "info" },
  [PaymentStatus.REJECTED]: { label: "Rechazado", tone: "danger" },
};

// El ícono dice cómo se pagó; su color, cómo va el pago.
const ICON_TONE: Record<PaymentStatus, string> = {
  [PaymentStatus.CONFIRMED]: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  [PaymentStatus.PENDING]: "bg-ios-blue/10 text-ios-blue",
  [PaymentStatus.REJECTED]: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/** "Julio de 2026" si pagó una cuota; "3 cuotas" si pagó varias. */
function paymentTitle(pay: Payment): string {
  const charges = coveredCharges(pay);
  if (charges.length === 0) return "Abono a tu cuenta";
  if (charges.length === 1) return formatPeriod(charges[0].period);
  return `${charges.length} cuotas`;
}

/** Qué pagó, en palabras: el concepto de la cuota, o los meses si fueron varias. */
function paymentConcept(pay: Payment): string {
  const charges = coveredCharges(pay);
  if (charges.length === 0) return "Saldo a favor";
  if (charges.length === 1) return charges[0].description || "Cuota";
  return [...charges]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((c) => formatPeriod(c.period))
    .join(", ");
}

const bsAmount = (n: number) =>
  `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RATE_NAME: Record<RateCurrency, string> = { USD: "dólar", EUR: "euro" };

/**
 * Un pago en una fila: cómo se pagó (el ícono), qué cuota, cuánto y en qué va.
 * El detalle (a qué cuotas fue, Bs, tasa, recibos) queda plegado: casi nunca se
 * mira, y desplegado en cada fila convertía el historial en un muro de texto.
 */
export function PaymentRow({ payment: pay, multiUnit }: { payment: Payment; multiUnit: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { lines, credit } = paymentBreakdown(pay);
  // Con un solo departamento no hace falta repetirlo en cada cuota.
  const label = (c: Charge) =>
    multiUnit ? chargeLabelFull(c) : [formatPeriod(c.period), c.description].filter(Boolean).join(" · ");
  // Sin registro de aplicaciones (pagos viejos o en revisión), las cuotas elegidas.
  const items = lines.length
    ? lines.map((l) => ({ id: l.charge.id, label: label(l.charge), amount: l.amount as number | null }))
    : coveredCharges(pay).map((c) => ({ id: c.id, label: label(c), amount: null }));
  const units = [...new Set(coveredCharges(pay).map((c) => c.property?.code ?? pay.property?.code).filter(Boolean))];
  const byOther = pay.submittedBy && pay.submittedBy.id !== user?.id;
  const rejected = pay.status === PaymentStatus.REJECTED;
  const inBs = pay.currency === PaymentCurrency.BS;
  const cash = pay.bank === "Efectivo";
  const Icon = cash ? Banknote : ArrowLeftRight;
  // Los recibos anulados (al borrarse un pago que tocó sus cuotas) ya no valen.
  const receipts =
    pay.status === PaymentStatus.CONFIRMED ? (pay.receipts ?? []).filter((r) => !r.voidedAt && r.receiptNumber) : [];

  const download = async (receiptNumber: string) => {
    setDownloading(receiptNumber);
    try {
      await paymentService.downloadReceipt(pay.id, receiptNumber);
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ios-fill/50 focus:outline-none focus-visible:bg-ios-fill/50"
      >
        <span
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", ICON_TONE[pay.status])}
          title={pay.bank}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[14px] font-semibold leading-tight text-ios-label">{paymentTitle(pay)}</p>
            <Money value={formatCurrency(pay.amount)} className="shrink-0 text-[15px] font-semibold text-ios-label" />
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[12px] text-ios-secondary">
              {[multiUnit && units.join(", "), paymentConcept(pay)].filter(Boolean).join(" · ")}
            </p>
            <StatusMark {...PAYMENT_STATUS[pay.status]} className="shrink-0" />
          </div>
          <p className="mt-0.5 truncate text-[12px] tabular-nums text-ios-secondary">
            {[formatDate(pay.paymentDate), pay.bank, inBs && pay.amountBs ? bsAmount(Number(pay.amountBs)) : "En divisas"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {rejected && pay.rejectReason && !open && (
            <p className="mt-1 truncate text-[12px] text-red-600 dark:text-red-400">{pay.rejectReason}</p>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ios-tertiary transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="pb-4 pl-[4.25rem] pr-5">
          <div className="space-y-3 rounded-xl bg-ios-fill/60 px-4 py-3 text-[13px]">
            {rejected && pay.rejectReason && (
              <div className="rounded-lg bg-red-500/[0.08] px-3 py-2 text-red-700 dark:text-red-300">
                <span className="font-semibold">Motivo del rechazo:</span> {pay.rejectReason}
              </div>
            )}

            {items.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] text-ios-secondary">
                  {pay.status === PaymentStatus.CONFIRMED ? "Se aplicó a" : "Cuotas que paga"}
                </p>
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
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-ios-separator pt-3 text-[12px] sm:grid-cols-4">
              {/* Fecha y monto en Bs ya están en la fila: aquí lo que no cabe en ella. */}
              <Detail term="Modalidad" value={`${pay.bank}${inBs ? " en Bs" : " en divisas"}`} />
              {pay.reference && <Detail term="Referencia" value={pay.reference} />}
              {inBs && pay.exchangeRate && (
                <Detail
                  term={`Tasa BCV${pay.rateCurrency ? ` ${RATE_NAME[pay.rateCurrency]}` : ""}`}
                  value={formatRate(Number(pay.exchangeRate))}
                />
              )}
              {byOther && <Detail term="Registró" value={pay.submittedBy.fullName} />}
            </dl>

            {receipts.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-ios-separator pt-3">
                {receipts.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void download(r.receiptNumber)}
                    disabled={downloading === r.receiptNumber}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ios-card px-3 py-1.5 text-[12px] font-semibold text-brand-600 ring-1 ring-ios-separator transition-colors hover:bg-brand-50 disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading === r.receiptNumber ? "Descargando…" : `Recibo ${r.receiptNumber}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ios-secondary">{term}</dt>
      <dd className="truncate tabular-nums text-ios-label" title={value}>
        {value}
      </dd>
    </div>
  );
}
