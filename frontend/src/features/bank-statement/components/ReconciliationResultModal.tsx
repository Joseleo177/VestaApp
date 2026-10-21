import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, FileSpreadsheet } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ReconciliationResult, ReviewMatch } from "../services/reconciliation.service";

export const bs = (n: number) => `Bs. ${Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  open: boolean;
  onClose: () => void;
  result: ReconciliationResult | null;
  busyId: string | null;
  onConfirmFull: (m: ReviewMatch) => void;
  onConfirmPartial: (m: ReviewMatch) => void;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-ios-fill/60 px-3 py-2.5 text-center">
      <p className={cn("text-[22px] font-bold leading-tight tabular-nums text-ios-label", tone)}>{value}</p>
      <p className="text-[12px] text-ios-secondary">{label}</p>
    </div>
  );
}

/**
 * Lo que pasó al subir un extracto. Arriba las cifras; luego lo que pide una
 * decisión (montos que no cuadran), y al final, plegado, lo que se confirmó solo.
 */
export function ReconciliationResultModal({ open, onClose, result, busyId, onConfirmFull, onConfirmPartial }: Props) {
  const [showConfirmed, setShowConfirmed] = useState(false);
  if (!result) return null;

  const pendingReview = result.review.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="sm:max-w-2xl"
      title="Extracto procesado"
      description={
        pendingReview
          ? `${pendingReview} ${pendingReview === 1 ? "pago necesita" : "pagos necesitan"} tu revisión`
          : "Todo lo que coincidía quedó conciliado"
      }
      icon={
        <ModalIcon tone="bg-rose-500/[0.12] text-rose-600 dark:text-rose-400">
          <FileSpreadsheet className="h-5 w-5" />
        </ModalIcon>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Filas leídas" value={result.totalRows} />
          <Stat label="Nuevas" value={result.newEntries} />
          <Stat label="Confirmados" value={result.confirmed.length} tone="text-emerald-700 dark:text-emerald-400" />
          <Stat label="Por revisar" value={pendingReview} tone={pendingReview ? "text-amber-700 dark:text-amber-400" : undefined} />
        </div>
        {result.duplicates > 0 && (
          <p className="-mt-2 text-[12px] text-ios-secondary">
            {result.duplicates} {result.duplicates === 1 ? "fila ya estaba cargada" : "filas ya estaban cargadas"} y no se
            duplicaron.
          </p>
        )}

        {pendingReview > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Por revisar: la referencia coincide, el monto no
            </h3>
            <ul className="divide-y divide-ios-separator overflow-hidden rounded-xl border border-amber-500/30">
              {result.review.map((m) => {
                const busy = busyId === m.paymentId;
                return (
                  <li key={m.paymentId} className="space-y-2.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ios-label">
                          {m.ownerName} <span className="font-normal text-ios-secondary">· {m.propertyCode}</span>
                        </p>
                        <p className="text-[12px] tabular-nums text-ios-secondary">
                          Ref. {m.bankRef}
                          {m.bankDate && ` · ${formatDate(m.bankDate)}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-ios-secondary">Llegó al banco</p>
                        <Money value={bs(m.bankAmount)} className="text-[14px] font-semibold text-ios-label" />
                      </div>
                    </div>
                    <p className="rounded-lg bg-amber-500/[0.08] px-3 py-2 text-[12px] text-amber-800 dark:text-amber-300">
                      {m.reason}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="!h-8"
                        disabled={busy}
                        onClick={() => onConfirmPartial(m)}
                        title="Confirmar solo lo que llegó al banco: la cuota queda abonada en parte"
                      >
                        Confirmar lo recibido
                      </Button>
                      <Button size="sm" className="!h-8" loading={busy} onClick={() => onConfirmFull(m)}>
                        {!busy && <Check className="h-4 w-4" />}
                        Confirmar completo
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {result.confirmed.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowConfirmed((v) => !v)}
              aria-expanded={showConfirmed}
              className="flex w-full items-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              Confirmados automáticamente ({result.confirmed.length})
              <ChevronDown className={cn("ml-auto h-4 w-4 text-ios-secondary transition-transform", showConfirmed && "rotate-180")} />
            </button>
            {showConfirmed && (
              <ul className="mt-2 divide-y divide-ios-separator overflow-hidden rounded-xl border border-ios-separator">
                {result.confirmed.map((m) => (
                  <li key={m.paymentId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate text-ios-label">
                      {m.ownerName} <span className="text-ios-secondary">· {m.propertyCode} · Ref. {m.bankRef}</span>
                    </span>
                    <Money value={bs(m.bankAmount)} className="shrink-0 font-semibold text-ios-label" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {result.newEntries > 0 && result.confirmed.length === 0 && pendingReview === 0 && (
          <p className="rounded-xl bg-ios-fill/60 px-4 py-3 text-[13px] text-ios-secondary">
            Se guardaron los movimientos, pero ninguno coincidió con un pago por validar. Cuando los vecinos reporten sus
            pagos, usa “Conciliar pendientes”.
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
