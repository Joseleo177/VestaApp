import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PaymentCurrency } from "@/types/domain";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyBlock, LedgerEmpty, LedgerSkeleton, ledgerRow, RowIcon, stopRow } from "@/components/ui/Ledger";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusMark } from "@/components/ui/StatusMark";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { normalize } from "@/lib/search";
import { usePagination } from "@/lib/usePagination";
import { cn } from "@/lib/cn";
import { paymentService } from "@/features/payments/services/payment.service";
import { ReceiptRow, receiptService } from "../services/receipt.service";

type Filter = "ALL" | "VALID" | "VOID";
const COLS = 6;

const bs = (n: number) => `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "Julio de 2026" si ampara una cuota; "3 cuotas" si ampara varias. */
const coverTitle = (r: ReceiptRow) =>
  r.charges.length === 1 ? formatPeriod(r.charges[0].period) : r.charges.length ? `${r.charges.length} cuotas` : "—";
const coverDetail = (r: ReceiptRow) =>
  r.charges.length === 1
    ? r.charges[0].description
    : r.charges.map((c) => formatPeriod(c.period)).join(", ");

/** Vigente es lo normal (gris con visto); anulado está cerrado, tampoco es alarma. */
function ReceiptStatus({ r }: { r: ReceiptRow }) {
  return r.voidedAt ? (
    <StatusMark label="Anulado" tone="neutral" quiet="void" />
  ) : (
    <StatusMark label="Vigente" tone="success" quiet="check" />
  );
}

/**
 * Todos los recibos emitidos en un solo lugar: buscar uno por número, vecino o
 * mes y descargarlo, sin tener que entrar al departamento o al pago.
 */
export function ReceiptsPage() {
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    receiptService
      .list()
      .then(setRows)
      .catch(() => toast.error("No se pudieron cargar los recibos"))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const voided = rows.filter((r) => r.voidedAt).length;
    return { ALL: rows.length, VALID: rows.length - voided, VOID: voided };
  }, [rows]);

  const filtered = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (filter === "VALID" && r.voidedAt) return false;
      if (filter === "VOID" && !r.voidedAt) return false;
      if (!terms.length) return true;
      const hay = normalize(
        [
          r.receiptNumber,
          r.property?.code,
          r.property?.tower,
          r.property?.owner,
          r.payment?.reference,
          r.payment?.bank,
          ...r.charges.flatMap((c) => [c.period, formatPeriod(c.period), c.description]),
        ]
          .filter(Boolean)
          .join(" ")
      );
      // Varias palabras se exigen todas, en cualquier orden: "perez julio".
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, filter, search]);
  const paged = usePagination(filtered, 25);
  const latest = rows.find((r) => !r.voidedAt);

  const download = useCallback(async (r: ReceiptRow) => {
    if (!r.payment) return;
    setDownloading(r.id);
    try {
      await paymentService.downloadReceipt(r.payment.id, r.receiptNumber);
    } catch {
      toast.error(`No se pudo descargar ${r.receiptNumber}`);
    } finally {
      setDownloading(null);
    }
  }, []);

  const hasQuery = filter !== "ALL" || search.trim() !== "";
  const empty = hasQuery
    ? { title: "Ningún recibo coincide", hint: "Prueba con otro número, vecino, departamento o mes.", onClear: () => { setFilter("ALL"); setSearch(""); } }
    : { title: "Todavía no hay recibos", hint: "Se emiten solos al confirmar un pago." };

  return (
    <Page
      module="Día a día"
      title="Recibos"
      subheader={
        !loading && rows.length > 0 ? (
          <p className="text-[14px] text-ios-secondary">
            {counts.VALID} {counts.VALID === 1 ? "recibo vigente" : "recibos vigentes"}
            {counts.VOID > 0 && ` · ${counts.VOID} ${counts.VOID === 1 ? "anulado" : "anulados"}`}
            {latest && ` · el último, ${latest.receiptNumber}, del ${formatDate(latest.issuedAt)}`}. Toca uno para descargarlo.
          </p>
        ) : undefined
      }
    >
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ios-separator p-4 lg:flex-row lg:items-center">
          <Segmented<Filter>
            aria-label="Estado del recibo"
            value={filter}
            onChange={setFilter}
            className="self-start"
            options={[
              { key: "ALL", label: "Todos", count: counts.ALL },
              { key: "VALID", label: "Vigentes", count: counts.VALID },
              ...(counts.VOID ? [{ key: "VOID" as Filter, label: "Anulados", count: counts.VOID }] : []),
            ]}
          />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="N.º, vecino, departamento o mes"
            className="lg:ml-auto lg:w-80"
            hotkey
          />
        </div>

        {/* ── Escritorio ── */}
        <div className="hidden overflow-x-auto md:block">
          <table className="table-ledger min-w-[860px]">
            <thead>
              <tr>
                <th className="pl-5">Recibo</th>
                <th>Vecino</th>
                <th>Cuotas</th>
                <th className="text-right">Monto</th>
                <th>Estado</th>
                <th className="w-px pr-5">
                  <span className="sr-only">Descargar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LedgerSkeleton cols={COLS} />
              ) : paged.items.length === 0 ? (
                <LedgerEmpty cols={COLS} {...empty} />
              ) : (
                paged.items.map((r) => (
                  <tr key={r.id} {...ledgerRow(() => void download(r))} className={cn("ledger-row", r.voidedAt && "[&>td]:opacity-60")}>
                    <td className="pl-5">
                      <p className="font-semibold tabular-nums text-ios-label">{r.receiptNumber}</p>
                      <p className="text-[12px] tabular-nums text-ios-secondary">{formatDate(r.issuedAt)}</p>
                    </td>
                    <td className="max-w-0 w-[26%]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={r.property?.owner ?? "?"} tone={r.voidedAt ? "neutral" : "brand"} className="!h-8 !w-8 !text-[11px]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ios-label">{r.property?.owner ?? "—"}</p>
                          <p className="truncate text-[12px] text-ios-secondary">
                            {[r.property?.code, r.property?.tower].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-0">
                      <p className="truncate font-medium text-ios-label">{coverTitle(r)}</p>
                      <p className="truncate text-[12px] text-ios-secondary" title={coverDetail(r)}>
                        {coverDetail(r)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {r.payment ? (
                        <>
                          <Money value={formatCurrency(r.payment.amount)} className="font-semibold text-ios-label" />
                          <p className="text-[12px] tabular-nums text-ios-secondary">
                            {r.payment.currency === PaymentCurrency.BS && r.payment.amountBs ? bs(r.payment.amountBs) : "En divisas"}
                          </p>
                        </>
                      ) : (
                        <span className="text-ios-tertiary">—</span>
                      )}
                    </td>
                    <td className="max-w-[180px]">
                      <ReceiptStatus r={r} />
                      {r.voidReason && (
                        <p className="truncate text-[12px] text-ios-secondary" title={r.voidReason}>
                          {r.voidReason}
                        </p>
                      )}
                    </td>
                    <td className="cursor-default pr-5" onClick={stopRow}>
                      <RowIcon
                        icon={Download}
                        title={`Descargar ${r.receiptNumber}`}
                        busy={downloading === r.id}
                        disabled={!r.payment}
                        onClick={() => void download(r)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Móvil ── */}
        <div className="space-y-2 p-3 md:hidden">
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[72px] w-full !rounded-xl" />)
          ) : paged.items.length === 0 ? (
            <EmptyBlock {...empty} />
          ) : (
            paged.items.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => void download(r)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border border-ios-separator p-3 text-left transition-colors active:bg-ios-fill",
                  r.voidedAt && "opacity-60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold tabular-nums text-ios-label">{r.receiptNumber}</span>
                    {r.payment && <Money value={formatCurrency(r.payment.amount)} className="shrink-0 font-semibold text-ios-label" />}
                  </div>
                  <p className="truncate text-[12px] text-ios-secondary">
                    {[r.property?.owner, r.property?.code, coverTitle(r)].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[12px] tabular-nums text-ios-secondary">{formatDate(r.issuedAt)}</span>
                    <ReceiptStatus r={r} />
                  </div>
                </div>
                <Download className="h-4 w-4 shrink-0 text-ios-secondary" />
              </button>
            ))
          )}
        </div>

        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="recibos"
        />
      </Card>
    </Page>
  );
}
