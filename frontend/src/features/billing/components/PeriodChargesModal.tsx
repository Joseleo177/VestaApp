import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, CalendarClock, Download, Receipt } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyBlock, RowIcon } from "@/components/ui/Ledger";
import { RowMenu } from "@/components/ui/RowMenu";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { Charge, ChargeStatus, ChargeType, RateCurrency } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { matchesTerm } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";
import { paymentService } from "@/features/payments/services/payment.service";
import { progressOf } from "../hooks/usePeriods";
import { WriteOffDialog } from "./WriteOffDialog";
import { DueDateDialog, DueDateTarget, mergeDue } from "./DueDateDialog";

interface PeriodChargesModalProps {
  period: string | null;
  type: string | null;
  open: boolean;
  onClose: () => void;
  /** Tras exonerar, condonar o cambiar la tasa: la lista de períodos se actualiza. */
  onChanged?: () => void;
}

type Filter = "ALL" | "OPEN" | "PAID" | "EXONERATED";

const isOpen = (c: Charge) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL;

// Pagada es lo normal (gris con visto); lo vencido es lo único en rojo.
function statusOf(c: Charge): StatusDef {
  switch (c.status) {
    case ChargeStatus.PAID:
      return { label: "Pagada", tone: "success", quiet: "check" };
    case ChargeStatus.EXONERATED:
      return { label: "Exonerada", tone: "violet" };
    case ChargeStatus.PARTIAL:
      return { label: "Abonada en parte", tone: "warning" };
    default:
      return c.overdue ? { label: "Vencida", tone: "danger" } : { label: "Pendiente", tone: "warning" };
  }
}

const otherCurrency = (c: RateCurrency) => (c === RateCurrency.USD ? RateCurrency.EUR : RateCurrency.USD);

/** "dólar" / "euro": dicho con palabras, no con "Bs a tasa $". */
const RATE_NAME: Record<RateCurrency, string> = { USD: "dólar", EUR: "euro" };

export function PeriodChargesModal({ period, type, open, onClose, onChanged }: PeriodChargesModalProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changingAll, setChangingAll] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState<Charge | null>(null);
  const [dueTarget, setDueTarget] = useState<DueDateTarget | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const load = () => {
    if (!period) return;
    setLoading(true);
    billingService
      .listForPeriod(period, type ?? undefined)
      .then(setCharges)
      .catch(() => toast.error("No se pudieron cargar las cuotas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !period) return;
    setFilter("ALL");
    setSearch("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, period, type]);

  const replace = (updated: Charge) => {
    setCharges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    onChanged?.();
  };

  const progress = useMemo(() => progressOf(charges), [charges]);
  const pct = progress.billable > 0 ? Math.round((progress.collected / progress.billable) * 100) : 100;
  const unpaid = charges.filter((c) => c.status !== ChargeStatus.PAID);
  const counts: Record<Filter, number> = {
    ALL: charges.length,
    OPEN: charges.filter(isOpen).length,
    PAID: charges.filter((c) => c.status === ChargeStatus.PAID).length,
    EXONERATED: progress.exonerated,
  };

  const filtered = useMemo(() => {
    const byStatus = charges.filter((c) =>
      filter === "ALL" ? true : filter === "OPEN" ? isOpen(c) : c.status === filter
    );
    return byStatus
      .filter((c) => matchesTerm(search, [c.property?.code, c.property?.tower?.name, c.description]))
      .sort((a, b) => (a.property?.code ?? "").localeCompare(b.property?.code ?? "", "es", { numeric: true }));
  }, [charges, filter, search]);
  const paged = usePagination(filtered, 15);

  /** Cambia la tasa de todas las cuotas no pagadas del lote. */
  const changeAll = async (currency: RateCurrency) => {
    if (!period || !type) return;
    setChangingAll(true);
    try {
      const { updated } = await billingService.setPeriodCurrency(period, type as ChargeType, currency);
      toast.success(`${updated} ${updated === 1 ? "cuota pasa" : "cuotas pasan"} a cobrarse con la tasa del ${RATE_NAME[currency]}`);
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cambiar la tasa");
    } finally {
      setChangingAll(false);
    }
  };

  const changeOne = async (charge: Charge) => {
    setBusyId(charge.id);
    try {
      const updated = await billingService.setChargeCurrency(charge.id, otherCurrency(charge.currency));
      replace({ ...charge, currency: updated.currency });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cambiar la tasa");
    } finally {
      setBusyId(null);
    }
  };

  const toggleExonerated = async (charge: Charge) => {
    const exonerate = charge.status !== ChargeStatus.EXONERATED;
    setBusyId(charge.id);
    try {
      replace(await billingService.setExonerated(charge.id, exonerate));
      toast.success(exonerate ? `${charge.property?.code ?? "Cuota"} exonerada` : "Cuota reactivada");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  };

  /** El recibo se pide por su número: es el que cubre esta cuota concreta. */
  const download = async (charge: Charge) => {
    const cp = charge.confirmedPayment;
    if (!cp?.id || !cp.receiptNumber) return;
    setBusyId(charge.id);
    try {
      await paymentService.downloadReceipt(cp.id, cp.receiptNumber);
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setBusyId(null);
    }
  };

  const unpaidCurrency = unpaid.length && unpaid.every((u) => u.currency === unpaid[0].currency) ? unpaid[0].currency : null;
  const mixedRates = new Set(charges.map((c) => c.currency)).size > 1;

  // Vencimiento del lote: el más repetido entre las no pagadas (o entre todas si no
  // queda ninguna). Si alguna se corrigió aparte, el lote tiene vencimientos distintos.
  const dueBase = unpaid.length ? unpaid : charges;
  const dueCounts = new Map<string, number>();
  dueBase.forEach((c) => dueCounts.set(c.dueDate.slice(0, 10), (dueCounts.get(c.dueDate.slice(0, 10)) ?? 0) + 1));
  const periodDue = [...dueCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mixedDue = dueCounts.size > 1;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="sm:max-w-4xl"
        title={period ? formatPeriod(period) : "Cuotas"}
        description={`${type === ChargeType.SPECIAL ? "Cuota especial" : "Cuota regular"} · ${charges.length} departamentos`}
        icon={
          <ModalIcon tone="bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400">
            <Receipt className="h-5 w-5" />
          </ModalIcon>
        }
      >
        {/* ── Resumen de la cobranza ── */}
        {loading ? (
          <Skeleton className="mb-4 h-20 w-full !rounded-2xl" />
        ) : (
          <div className="mb-4 rounded-2xl bg-ios-fill/60 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[12px] text-ios-secondary">Cobrado</p>
                <p className="text-[26px] font-bold leading-tight text-ios-label">
                  {pct}%{" "}
                  <span className="text-[13px] font-medium text-ios-secondary">
                    · <Money value={formatCurrency(progress.collected)} /> de <Money value={formatCurrency(progress.billable)} />
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-ios-secondary">Por cobrar</p>
                <Money
                  value={formatCurrency(Math.max(0, progress.billable - progress.collected))}
                  className="text-[17px] font-semibold text-ios-label"
                />
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100" aria-hidden>
              <div
                className={progress.open === 0 ? "h-full rounded-full bg-emerald-500" : "h-full rounded-full bg-brand-600"}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Vencimiento del lote, corregible si se cargó mal al emitir. */}
            {periodDue && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ios-separator pt-3 text-[13px]">
                <span className="flex items-center gap-1.5 text-ios-secondary">
                  <CalendarClock className="h-4 w-4" />
                  Vence el <span className="font-semibold text-ios-label">{formatDate(periodDue)}</span>
                  {mixedDue && <span className="text-amber-700 dark:text-amber-400">· algunas cuotas tienen otra fecha</span>}
                </span>
                {unpaid.length > 0 && period && type && (
                  <button
                    type="button"
                    onClick={() =>
                      setDueTarget({
                        kind: "period",
                        period,
                        type: type as ChargeType,
                        current: periodDue,
                        moraAmount: Number(unpaid[0]?.moraAmount ?? 0),
                      })
                    }
                    className="font-semibold text-brand-600 hover:underline"
                  >
                    Cambiar vencimiento
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Filtros ── */}
        {/* El buscador baja a su propia línea cuando no cabe junto al filtro: así el
            filtro nunca queda cortado. Solo en un teléfono muy angosto se desplaza. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="no-scrollbar max-w-full shrink-0 overflow-x-auto">
            <Segmented<Filter>
              aria-label="Estado de la cuota"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "ALL", label: "Todas", count: counts.ALL },
                { key: "OPEN", label: "Por cobrar", count: counts.OPEN },
                { key: "PAID", label: "Pagadas", count: counts.PAID },
                ...(counts.EXONERATED ? [{ key: "EXONERATED" as Filter, label: "Exoneradas", count: counts.EXONERATED }] : []),
              ]}
            />
          </div>
          <SearchField value={search} onChange={setSearch} placeholder="Departamento o torre" className="min-w-[200px] flex-1" />
        </div>

        {/* ── Con qué tasa se cobran en bolívares ── */}
        {!loading && unpaid.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-ios-separator px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-ios-label">¿Con qué tasa se cobra en bolívares?</p>
              <p className="text-[12px] text-ios-secondary">
                Las cuotas están en REF. Quien pague en Bs paga al cambio de esta tasa BCV.
                {unpaidCurrency
                  ? " Las ya pagadas conservan la tasa con que se pagaron."
                  : " Hoy hay cuotas con tasas distintas: elige una para igualarlas."}
              </p>
            </div>
            <Segmented
              aria-label="Tasa para cobrar en bolívares"
              value={unpaidCurrency ?? ("MIXED" as RateCurrency)}
              onChange={(c) => !changingAll && c !== unpaidCurrency && void changeAll(c)}
              options={[
                { key: RateCurrency.USD, label: "Dólar" },
                { key: RateCurrency.EUR, label: "Euro" },
              ]}
            />
          </div>
        )}

        {/* ── Cuotas ── */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full !rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyBlock
            title="Ninguna cuota aquí"
            hint={search ? "Prueba con otro departamento o torre." : "No hay cuotas en este estado."}
          />
        ) : (
          <ul className="divide-y divide-ios-separator overflow-hidden rounded-xl border border-ios-separator">
            {paged.items.map((c) => {
              const busy = busyId === c.id;
              const cp = c.confirmedPayment;
              const paid = Number(c.amountPaid ?? 0);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
                  <span className="flex h-10 min-w-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-ios-fill px-2 text-[13px] font-bold tabular-nums text-ios-label">
                    {c.property?.code ?? "—"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <StatusMark {...statusOf(c)} />
                    <p className="mt-0.5 truncate text-[12px] text-ios-secondary">
                      {[
                        c.property?.tower?.name,
                        // La tasa solo se nombra si el período mezcla tasas: si todas son
                        // iguales, ya lo dice el control de arriba.
                        mixedRates && `Tasa del ${RATE_NAME[c.currency]}`,
                        // Igual con el vencimiento: solo si esta cuota tiene otro distinto al del lote.
                        mixedDue && c.dueDate.slice(0, 10) !== periodDue && `Vence ${formatDate(c.dueDate)}`,
                        cp && `Pagada el ${formatDate(cp.paymentDate)}${cp.reference ? ` · Ref. ${cp.reference}` : ""}`,
                        c.status === ChargeStatus.PARTIAL && paid > 0 && `Abonó ${formatCurrency(paid)}`,
                        c.writeOff && `Condonado ${formatCurrency(c.writeOff.amount)}: ${c.writeOff.reason}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="w-28 shrink-0 text-right">
                    <Money
                      value={formatCurrency(c.status === ChargeStatus.PAID ? c.amountPaid ?? c.amount : c.amountDue ?? c.amount)}
                      className="text-[14px] font-semibold text-ios-label"
                    />
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">con mora</p>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 items-center justify-end gap-0.5 sm:w-[148px]">
                    {c.status === ChargeStatus.PAID ? (
                      cp?.receiptNumber && (
                        <RowIcon icon={Download} title={`Descargar recibo ${cp.receiptNumber}`} busy={busy} onClick={() => download(c)} />
                      )
                    ) : c.status === ChargeStatus.PARTIAL ? (
                      // Con abono no se exonera (se perdería lo pagado): se condona el resto.
                      <Button
                        size="sm"
                        variant="outline"
                        className="!h-8"
                        onClick={() => setWriteOffTarget(c)}
                        disabled={busy || !!c.pendingPayment}
                        title={c.pendingPayment ? "Tiene un pago en revisión" : "Perdonar el saldo restante"}
                      >
                        Condonar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="!h-8"
                        loading={busy}
                        onClick={() => toggleExonerated(c)}
                      >
                        {c.status === ChargeStatus.EXONERATED ? "Reactivar" : "Exonerar"}
                      </Button>
                    )}
                    {/* Cambiar la tasa es ocasional: va al menú, dicho con palabras. Una
                        cuota pagada conserva la tasa con que se pagó. */}
                    {c.status !== ChargeStatus.PAID && (
                      <RowMenu
                        items={[
                          {
                            label: `Cobrar con la tasa del ${RATE_NAME[otherCurrency(c.currency)]}`,
                            icon: ArrowLeftRight,
                            onClick: () => void changeOne(c),
                            disabled: busy,
                            hint: `Hoy se cobra en Bs con la tasa del ${RATE_NAME[c.currency]}`,
                          },
                          {
                            label: "Cambiar vencimiento",
                            icon: CalendarClock,
                            onClick: () => setDueTarget({ kind: "charge", charge: c }),
                            disabled: busy,
                            hint: `Hoy vence el ${formatDate(c.dueDate)}`,
                          },
                        ]}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="cuotas"
          className="mt-2 border-t-0 px-0"
        />
      </Modal>

      <WriteOffDialog
        charge={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
        onDone={(updated) => {
          replace(updated);
          setWriteOffTarget(null);
        }}
      />

      <DueDateDialog
        target={dueTarget}
        onClose={() => setDueTarget(null)}
        onDone={(updated) => {
          const t = dueTarget;
          setDueTarget(null);
          // Una cuota vuelve actualizada (se combina con la de la lista, que trae
          // departamento y pagos); un lote completo se recarga.
          if (updated && t?.kind === "charge") replace(mergeDue(t.charge, updated));
          else {
            load();
            onChanged?.();
          }
        }}
      />
    </>
  );
}
