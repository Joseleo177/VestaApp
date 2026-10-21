import { Check, Trash2, X } from "lucide-react";
import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  EmptyBlock,
  LedgerEmpty,
  LedgerSkeleton,
  ledgerRow,
  ROW_TONE,
  RowIcon,
  stopRow,
} from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { chargeLabelFull, coveredCharges, paymentTitle } from "../coveredCharges";

// Para el administrador, lo único que pide acción es lo que falta validar: ese va
// en ámbar y con filete. Confirmado es lo normal y rechazado ya está cerrado.
export const ADMIN_PAYMENT_STATUS: Record<PaymentStatus, StatusDef> = {
  [PaymentStatus.PENDING]: { label: "Por validar", tone: "warning" },
  [PaymentStatus.CONFIRMED]: { label: "Confirmado", tone: "success", quiet: "check" },
  [PaymentStatus.REJECTED]: { label: "Rechazado", tone: "neutral", quiet: "void" },
};

const COLS = 6;

const bs = (n: number) => `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Debajo del título: el departamento y el concepto de la cuota (o el de cada una). */
function coverageDetail(p: Payment): string {
  const charges = coveredCharges(p);
  if (charges.length === 1) return [p.property?.code, charges[0].description].filter(Boolean).join(" · ");
  const units = [...new Set(charges.map((c) => c.property?.code ?? p.property?.code).filter(Boolean))];
  return units.join(", ");
}

interface PaymentsTableProps {
  payments: Payment[];
  loading: boolean;
  hasQuery: boolean;
  onClear: () => void;
  ownerName: (p: Payment) => string;
  busyId: string | null;
  onOpen: (p: Payment) => void;
  onConfirm: (p: Payment) => void;
  onReject: (p: Payment) => void;
  onDelete: (p: Payment) => void;
}

function Actions({ p, busy, onConfirm, onReject, onDelete }: {
  p: Payment;
  busy: boolean;
  onConfirm: (p: Payment) => void;
  onReject: (p: Payment) => void;
  onDelete: (p: Payment) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {p.status === PaymentStatus.PENDING && (
        <>
          {/* La acción que resuelve lo pendiente es el único botón con peso. */}
          <Button size="sm" className="mr-1 !h-8 !px-3" loading={busy} onClick={() => onConfirm(p)}>
            {!busy && <Check className="h-4 w-4" />}
            Confirmar
          </Button>
          <RowIcon icon={X} tone="danger" title="Rechazar pago" disabled={busy} onClick={() => onReject(p)} />
        </>
      )}
      <RowIcon icon={Trash2} tone="danger" title="Eliminar pago" disabled={busy} onClick={() => onDelete(p)} />
    </div>
  );
}

/**
 * Pagos en tabla libro desde `lg`; por debajo, tarjetas. La fila abre la ficha
 * del pago, que es donde vive el reparto entre cuotas: dentro de la fila, en
 * verde y morado, era lo que más ruido hacía.
 */
export function PaymentsTable(props: PaymentsTableProps) {
  const { payments, loading, hasQuery, onClear, ownerName, busyId, onOpen } = props;
  const empty = hasQuery
    ? { title: "Ningún pago coincide", hint: "Prueba con otro nombre, departamento, referencia o mes.", onClear }
    : { title: "No hay pagos aquí", hint: "Los pagos que registren los vecinos o cargues tú aparecerán en esta lista." };

  return (
    <>
      {/* ── Escritorio ── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="table-ledger min-w-[940px]">
          <thead>
            <tr>
              <th className="pl-5">Vecino</th>
              <th>Cuotas</th>
              <th>Pago</th>
              <th className="text-right">Monto</th>
              <th>Estado</th>
              <th className="w-px pr-5">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LedgerSkeleton cols={COLS} />
            ) : payments.length === 0 ? (
              <LedgerEmpty cols={COLS} {...empty} />
            ) : (
              payments.map((p) => {
                const who = ownerName(p);
                const pending = p.status === PaymentStatus.PENDING;
                const byOther = p.submittedBy && p.submittedBy.fullName !== who;
                return (
                  <tr key={p.id} {...ledgerRow(() => onOpen(p), pending ? ROW_TONE.warning : undefined)}>
                    <td className="w-[24%] max-w-0 pl-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={who} tone={pending ? "brand" : "neutral"} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ios-label">{who}</p>
                          <p className="truncate text-[12px] text-ios-secondary">
                            {byOther ? `Registró: ${p.submittedBy.fullName}` : "Registrado por el vecino"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-0">
                      <p
                        className="truncate font-medium text-ios-label"
                        title={coveredCharges(p).map(chargeLabelFull).join("\n")}
                      >
                        {paymentTitle(p)}
                      </p>
                      <p className="truncate text-[12px] text-ios-secondary">{coverageDetail(p)}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <p className="tabular-nums text-ios-label">{formatDate(p.paymentDate)}</p>
                      <p className="text-[12px] text-ios-secondary">
                        {[p.bank, p.reference && `Ref. ${p.reference}`].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <Money value={formatCurrency(p.amount)} className="font-semibold text-ios-label" />
                      <p className="text-[12px] tabular-nums text-ios-secondary">
                        {p.currency === PaymentCurrency.BS && p.amountBs ? bs(Number(p.amountBs)) : "En divisas"}
                      </p>
                    </td>
                    <td className="max-w-[180px]">
                      <StatusMark {...ADMIN_PAYMENT_STATUS[p.status]} />
                      {p.status === PaymentStatus.REJECTED && p.rejectReason && (
                        <p className="mt-0.5 truncate text-[12px] text-ios-secondary" title={p.rejectReason}>
                          {p.rejectReason}
                        </p>
                      )}
                    </td>
                    <td className="cursor-default whitespace-nowrap pr-5" onClick={stopRow}>
                      <Actions
                        p={p}
                        busy={busyId === p.id}
                        onConfirm={props.onConfirm}
                        onReject={props.onReject}
                        onDelete={props.onDelete}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Móvil y tablet ── */}
      <div className="space-y-2 p-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-ios-separator p-3">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        ) : payments.length === 0 ? (
          <EmptyBlock {...empty} />
        ) : (
          payments.map((p) => {
            const who = ownerName(p);
            const pending = p.status === PaymentStatus.PENDING;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(p)}
                onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && onOpen(p)}
                className={cn(
                  "rounded-xl border border-ios-separator p-3 transition-colors active:bg-ios-fill",
                  pending && "shadow-[inset_3px_0_0_#f59e0b]"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={who} tone={pending ? "brand" : "neutral"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold text-ios-label">{who}</p>
                      <Money value={formatCurrency(p.amount)} className="shrink-0 text-[15px] font-semibold text-ios-label" />
                    </div>
                    <p className="truncate text-[12px] text-ios-secondary">
                      {[paymentTitle(p), p.property?.code, formatDate(p.paymentDate)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ios-separator pt-2.5">
                  <StatusMark {...ADMIN_PAYMENT_STATUS[p.status]} />
                  <div onClick={stopRow} onKeyDown={stopRow}>
                    <Actions
                      p={p}
                      busy={busyId === p.id}
                      onConfirm={props.onConfirm}
                      onReject={props.onReject}
                      onDelete={props.onDelete}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
