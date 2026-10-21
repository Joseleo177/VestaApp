import { useCallback, useEffect, useMemo, useState } from "react";
import { PenLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { RateCurrency } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toISODate } from "@/components/ui/DatePicker";
import { LedgerEmpty, LedgerSkeleton } from "@/components/ui/Ledger";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { usePagination } from "@/lib/usePagination";
import { formatDate, formatRate, rateUnit } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import { useExchangeRate } from "../hooks/useExchangeRate";
import { exchangeRateService, ExchangeRateRecord, RateConfig } from "../services/exchange-rate.service";
import { CURRENCY_NAME, Delta, pctChange, RateCard } from "../components/RateCard";
import { ManualRateModal } from "../components/ManualRateModal";

const CURRENCIES = [RateCurrency.USD, RateCurrency.EUR];

/** Interruptor de la lista de monedas: dice el estado, no la acción. */
function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-brand-600" : "bg-ios-separator"
      )}
    >
      <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

interface DayRow {
  date: string;
  rates: Partial<Record<RateCurrency, ExchangeRateRecord>>;
}

/** Tasas BCV: las vigentes, qué monedas se cobran y el historial día a día. */
export function ExchangeRatePage() {
  const { data: current, refresh } = useExchangeRate();
  const [config, setConfig] = useState<RateConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [history, setHistory] = useState<ExchangeRateRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [view, setView] = useState<"ALL" | RateCurrency>("ALL");

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await exchangeRateService.history());
    } catch {
      toast.error("No se pudo cargar el historial de tasas");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    exchangeRateService.getConfig().then(setConfig).catch(() => {});
  }, [loadHistory]);

  // Historial por moneda, del más reciente al más viejo: alimenta tarjetas y variaciones.
  const byCurrency = useMemo(() => {
    const map: Record<RateCurrency, ExchangeRateRecord[]> = { USD: [], EUR: [] };
    [...history].sort((a, b) => b.date.localeCompare(a.date)).forEach((h) => map[h.currency]?.push(h));
    return map;
  }, [history]);

  // Una fila por fecha, con las dos monedas lado a lado.
  const days = useMemo<DayRow[]>(() => {
    const map = new Map<string, DayRow>();
    history.forEach((h) => {
      const row = map.get(h.date) ?? { date: h.date, rates: {} };
      row.rates[h.currency] = h;
      map.set(h.date, row);
    });
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [history]);
  const paged = usePagination(days, 20);

  const enabled = config?.enabled ?? CURRENCIES;
  const primary = config?.primary ?? current?.primary ?? RateCurrency.EUR;
  const shown = view === "ALL" ? CURRENCIES.filter((c) => enabled.includes(c) || byCurrency[c].length) : [view];
  const today = toISODate(new Date());

  /** La tasa anterior a `date` en la misma moneda, para la variación diaria. */
  const previousOf = (c: RateCurrency, date: string) => byCurrency[c].find((h) => h.date < date);

  const saveConfig = async (next: RateConfig) => {
    setSavingConfig(true);
    try {
      setConfig(await exchangeRateService.saveConfig(next));
      toast.success("Monedas de cobro actualizadas");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchBcv = async () => {
    setFetching(true);
    try {
      const { rates } = await exchangeRateService.fetchFromBcv();
      toast.success("Tasas BCV actualizadas: " + rates.map((r) => `${formatRate(r.rate)} ${rateUnit(r.currency)}`).join(" · "));
      await Promise.all([refresh(), loadHistory()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo obtener la tasa del BCV");
    } finally {
      setFetching(false);
    }
  };

  return (
    <Page
      module="Finanzas y ajustes"
      title="Tasa BCV"
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Registrar a mano</span>
            <span className="sm:hidden">A mano</span>
          </Button>
          <Button size="sm" onClick={fetchBcv} loading={fetching}>
            {!fetching && <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Actualizar desde BCV</span>
            <span className="sm:hidden">BCV</span>
          </Button>
        </>
      }
      subheader={
        <p className="text-[14px] text-ios-secondary">
          Las cuotas están en divisas; estas tasas las convierten a bolívares al registrar pagos en Bs.
        </p>
      }
    >
      {/* ── Tasas vigentes ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {CURRENCIES.map((c) => (
          <RateCard
            key={c}
            currency={c}
            current={current?.rates.find((r) => r.currency === c) ?? null}
            history={byCurrency[c]}
            primary={primary === c}
            enabled={enabled.includes(c)}
          />
        ))}
      </div>

      {/* ── Monedas de cobro ── */}
      {config && (
        <Card className="overflow-hidden">
          <div className="border-b border-ios-separator px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ios-label">Monedas de cobro</h2>
            <p className="text-[13px] text-ios-secondary">
              Con qué tasa se convierte cada cuota a bolívares. La principal viene elegida al emitir cuotas y valora el saldo a
              favor.
            </p>
          </div>
          <ul className="divide-y divide-ios-separator">
            {CURRENCIES.map((c) => {
              const on = config.enabled.includes(c);
              const isPrimary = config.primary === c;
              return (
                <li key={c} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-ios-label">
                      BCV {CURRENCY_NAME[c].toLowerCase()} ({c})
                    </p>
                    <p className="text-[12px] text-ios-secondary">
                      {isPrimary
                        ? "Moneda principal: no se puede desactivar"
                        : on
                          ? "Se consulta al BCV y se puede elegir al emitir cuotas"
                          : "Desactivada: sus cuotas pendientes se cobran con la última tasa guardada"}
                    </p>
                  </div>
                  {on && !isPrimary && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="!h-8"
                      disabled={savingConfig}
                      onClick={() => void saveConfig({ ...config, primary: c })}
                    >
                      Hacer principal
                    </Button>
                  )}
                  {isPrimary && (
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Principal</span>
                  )}
                  <Switch
                    on={on}
                    label={`${on ? "Desactivar" : "Activar"} ${CURRENCY_NAME[c]}`}
                    disabled={savingConfig || isPrimary}
                    onClick={() =>
                      void saveConfig({
                        ...config,
                        enabled: on ? config.enabled.filter((x) => x !== c) : [...config.enabled, c],
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── Historial ── */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ios-separator px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ios-label">Historial</h2>
            <p className="text-[12px] text-ios-secondary">
              Una fila por día con las dos monedas; “—” si ese día no se guardó esa moneda.
            </p>
          </div>
          <Segmented
            aria-label="Moneda"
            value={view}
            onChange={setView}
            options={[{ key: "ALL", label: "Ambas" }, ...CURRENCIES.map((c) => ({ key: c, label: c }))]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="table-ledger min-w-[520px]">
            <thead>
              <tr>
                <th className="pl-5">Fecha</th>
                {shown.map((c) => (
                  <th key={c} className="text-right">
                    {CURRENCY_NAME[c]} (Bs/{c})
                  </th>
                ))}
                <th className="pr-5 text-right">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <LedgerSkeleton cols={shown.length + 2} rows={6} />
              ) : days.length === 0 ? (
                <LedgerEmpty cols={shown.length + 2} title="Aún no hay tasas guardadas" hint="Actualiza desde el BCV para guardar la primera." />
              ) : (
                paged.items.map((d) => {
                  const manual = shown.some((c) => d.rates[c]?.source === "MANUAL");
                  return (
                    <tr key={d.date}>
                      <td className="pl-5">
                        <span className="font-medium tabular-nums text-ios-label">{formatDate(d.date)}</span>
                        {d.date === today && (
                          <span className="ml-2 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">Hoy</span>
                        )}
                      </td>
                      {shown.map((c) => {
                        const r = d.rates[c];
                        return (
                          <td key={c} className="text-right">
                            {r ? (
                              <>
                                <p className="font-semibold tabular-nums text-ios-label">{formatRate(Number(r.rate))}</p>
                                <Delta value={pctChange(Number(r.rate), Number(previousOf(c, d.date)?.rate))} />
                              </>
                            ) : (
                              <span className="text-ios-tertiary">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="pr-5 text-right">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                            manual ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-ios-fill text-ios-secondary"
                          )}
                        >
                          {manual ? "Manual" : "BCV"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          from={paged.from}
          to={paged.to}
          onPageChange={paged.setPage}
          label="días"
        />
        {/* Siempre a la vista, aunque quepa en una página: así se ve que no falta nada.
            Hay menos filas que tasas porque cada día junta sus dos monedas. */}
        {!loadingHistory && days.length > 0 && paged.totalPages <= 1 && (
          <p className="border-t border-ios-separator px-5 py-3 text-[12px] text-ios-secondary">
            {days.length} {days.length === 1 ? "día" : "días"} · {history.length}{" "}
            {history.length === 1 ? "tasa registrada" : "tasas registradas"} desde el {formatDate(days[days.length - 1].date)}
          </p>
        )}
      </Card>

      <ManualRateModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        currencies={enabled.length ? enabled : CURRENCIES}
        defaultCurrency={primary}
        onSaved={async (date) => {
          setManualOpen(false);
          await Promise.all([date === today ? refresh() : Promise.resolve(), loadHistory()]);
        }}
      />
    </Page>
  );
}
