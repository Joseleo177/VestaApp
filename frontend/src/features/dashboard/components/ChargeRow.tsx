import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Charge, ChargeStatus, ChargeType } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Check";
import { RowIcon } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { paymentService } from "@/features/payments/services/payment.service";
import { dueAmount, isOpenCharge } from "../dueDays";
import { DueLabel, dueTone } from "./DueLabel";

interface ChargeRowProps {
  charge: Charge;
  multiUnit: boolean;
  /** Casilla para pagar varias juntas; sin ella la fila no se marca. */
  check?: { checked: boolean; onToggle: () => void };
  onPay?: (c: Charge) => void;
}

const Sep = () => <span aria-hidden>·</span>;

/**
 * Una cuota en dos renglones que se leen en paralelo: mes y monto arriba;
 * departamento, concepto y estado abajo. A la derecha, lo que se puede hacer
 * con ella: pagarla si está abierta, bajar el recibo si ya se pagó.
 */
export function ChargeRow({ charge: c, multiUnit, check, onPay }: ChargeRowProps) {
  const [downloading, setDownloading] = useState(false);
  const open = isOpenCharge(c);
  const inReview = open && !!c.pendingPayment;
  const tone = open ? dueTone(c.dueDate) : undefined;
  const paid = Number(c.amountPaid ?? 0);
  const receipt = c.confirmedPayment?.receiptNumber;
  const lastApp = c.applications?.[c.applications.length - 1];
  const paidOn = lastApp?.paymentDate ?? c.confirmedPayment?.paymentDate;
  const markable = !!check && !inReview;

  const download = async () => {
    if (!c.confirmedPayment || !receipt) return;
    setDownloading(true);
    try {
      await paymentService.downloadReceipt(c.confirmedPayment.id, receipt);
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li
      onClick={markable ? () => check?.onToggle() : undefined}
      className={cn(
        "relative flex items-center gap-3 px-5 py-3.5 transition-colors",
        markable && "cursor-pointer",
        check?.checked ? "bg-brand-50/60" : markable && "hover:bg-ios-fill/50"
      )}
    >
      {/* Filete: rojo si ya venció, ámbar si vence en tres días o menos. */}
      {tone && <span className={cn("absolute bottom-2 left-0 top-2 w-[3px] rounded-r", tone)} aria-hidden />}

      {check && (
        <Check
          checked={check.checked}
          disabled={inReview}
          onChange={check.onToggle}
          title={inReview ? "Ya tiene un pago en revisión" : "Incluir en el pago"}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold leading-tight text-ios-label">
            <span className="truncate">{formatPeriod(c.period)}</span>
            {c.type === ChargeType.SPECIAL && (
              <span className="shrink-0 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                Especial
              </span>
            )}
          </p>
          {c.status === ChargeStatus.EXONERATED ? (
            <StatusMark label="Exonerada" tone="violet" className="shrink-0" />
          ) : (
            <Money
              value={formatCurrency(open ? dueAmount(c) : c.amountPaid ?? c.amount)}
              className="shrink-0 text-[15px] font-semibold text-ios-label"
            />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-ios-secondary">
          {multiUnit && c.property && (
            <>
              <span className="font-semibold text-ios-label">{c.property.code}</span>
              <Sep />
            </>
          )}
          {c.description && (
            <>
              <span className="max-w-[15rem] truncate">{c.description}</span>
              <Sep />
            </>
          )}
          {open ? (
            <>
              <DueLabel dueDate={c.dueDate} />
              {c.status === ChargeStatus.PARTIAL && paid > 0 && (
                <>
                  <Sep />
                  <span>Abonaste {formatCurrency(paid)}</span>
                </>
              )}
            </>
          ) : c.status === ChargeStatus.PAID ? (
            <StatusMark label={paidOn ? `Pagada el ${formatDate(paidOn)}` : "Pagada"} tone="success" quiet="check" />
          ) : (
            <span>No se cobra</span>
          )}
        </div>
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {inReview ? (
          <StatusMark label="En revisión" tone="info" />
        ) : open ? (
          onPay && (
            <Button size="sm" variant="outline" onClick={() => onPay(c)}>
              Pagar
            </Button>
          )
        ) : (
          receipt && (
            <RowIcon icon={Download} title={`Descargar recibo ${receipt}`} busy={downloading} onClick={download} />
          )
        )}
      </div>
    </li>
  );
}
