import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Download, Receipt } from "lucide-react";
import { Modal, ModalIcon } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyBlock, RowIcon } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDef, StatusMark } from "@/components/ui/StatusMark";
import { Charge, ChargeStatus, ChargeType, RateCurrency } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod, rateLabel } from "@/lib/format";
import { matchesTerm } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { ApiError } from "@/services/api";
import { billingService } from "../services/billing.service";
import { paymentService } from "@/features/payments/services/payment.service";
import { progressOf } from "../hooks/usePeriods";
import { WriteOffDialog } from "./WriteOffDialog";

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

export function PeriodChargesModal({ period, type, open, onClose, onChanged }: PeriodChargesModalProps) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changingAll, setChangingAll] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState<Charge | null>(null);
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
      toast.success(`${updated} cuotas pasan a ${rateLabel(currency)}`);
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className="sm:max-w-3xl"
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
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="no-scrollbar -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
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
          <SearchField value={search} onChange={setSearch} placeholder="Departamento o torre" className="sm:ml-auto sm:w-56" />
        </div>

        {/* ── Tasa de las no pagadas ── */}
        {!loading && unpaid.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-ios-separator px-3.5 py-2.5 text-[13px]">
            <span className="text-ios-secondary">Tasa de las no pagadas:</span>
            <Segmented
              aria-label="Tasa de las cuotas no pagadas"
              value={unpaidCurrency ?? ("MIXED" as RateCurrency)}
              onChange={(c) => !changingAll && c !== unpaidCurrency && void changeAll(c)}
              options={[
                { key: RateCurrency.USD, label: "Dólar" },
                { key: RateCurrency.EUR, label: "Euro" },
              ]}
            />
            {!unpaidCurrency && <span className="text-[12px] font-medium text-amber-700 dark:text-amber-400">Hoy están mezcladas</span>}
            <span className="basis-full text-[12px] text-ios-secondary">
              Las pagadas conservan la tasa con que se pagaron.
            </span>
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
                    <div className="flex items-center gap-2">
                      <StatusMark {...statusOf(c)} />
                      {/* La tasa se cambia tocándola, mientras la cuota no esté pagada. */}
                      {c.status === ChargeStatus.PAID ? (
                        <span className="text-[11px] text-ios-tertiary">{rateLabel(c.currency)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void changeOne(c)}
                          disabled={busy}
                          title={`Cambiar a ${rateLabel(otherCurrency(c.currency))}`}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ios-secondary transition-colors hover:bg-ios-fill hover:text-ios-label disabled:opacity-50"
                        >
                          {rateLabel(c.currency)}
                          <ArrowLeftRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-ios-secondary">
                      {[
                        c.property?.tower?.name,
                        cp && `Pagada el ${formatDate(cp.paymentDate)}${cp.reference ? ` · Ref. ${cp.reference}` : ""}`,
                        c.status === ChargeStatus.PARTIAL && paid > 0 && `Abonó ${formatCurrency(paid)}`,
                        c.writeOff && `Condonado ${formatCurrency(c.writeOff.amount)}: ${c.writeOff.reason}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <Money
                      value={formatCurrency(c.status === ChargeStatus.PAID ? c.amountPaid ?? c.amount : c.amountDue ?? c.amount)}
                      className="text-[14px] font-semibold text-ios-label"
                    />
                    {c.overdue && c.status === ChargeStatus.PENDING && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">con mora</p>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 justify-end sm:w-[112px]">
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
    </>
  );
}
