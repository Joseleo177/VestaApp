import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { formatRate, formatDate, rateUnit } from "@/lib/format";
import { RateCurrency } from "@/types/domain";
import { useExchangeRate } from "../hooks/useExchangeRate";
import {
  exchangeRateService,
  ExchangeRateRecord,
  RateConfig,
} from "../services/exchange-rate.service";

const CURRENCY_NAME: Record<RateCurrency, string> = { USD: "Dólar ($)", EUR: "Euro (€)" };
import { ApiError } from "@/services/api";

export function ExchangeRatePage() {
  const { data: current, refresh } = useExchangeRate();
  const [config, setConfig] = useState<RateConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [manualCurrency, setManualCurrency] = useState<RateCurrency>(RateCurrency.USD);
  const [history, setHistory] = useState<ExchangeRateRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [manualRate, setManualRate] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
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
    exchangeRateService
      .getConfig()
      .then((c) => {
        setConfig(c);
        setManualCurrency(c.primary);
      })
      .catch(() => {});
  }, [loadHistory]);

  const handleSaveConfig = async (next: RateConfig) => {
    setSavingConfig(true);
    try {
      setConfig(await exchangeRateService.saveConfig(next));
      toast.success("Configuración de tasas guardada");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  const toggleEnabled = (currency: RateCurrency) => {
    if (!config) return;
    const enabled = config.enabled.includes(currency)
      ? config.enabled.filter((c) => c !== currency)
      : [...config.enabled, currency];
    void handleSaveConfig({ ...config, enabled });
  };

  const handleFetchBcv = async () => {
    setFetching(true);
    try {
      const { rates } = await exchangeRateService.fetchFromBcv();
      toast.success(
        "Tasas BCV actualizadas: " +
          rates.map((r) => `${formatRate(r.rate)} ${rateUnit(r.currency)}`).join(" · ")
      );
      await Promise.all([refresh(), loadHistory()]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo obtener la tasa BCV");
    } finally {
      setFetching(false);
    }
  };

  const handleSaveManual = async () => {
    const rateNum = parseFloat(manualRate.replace(",", "."));
    if (!rateNum || rateNum <= 0) {
      toast.error("Ingresa una tasa válida mayor a 0");
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await exchangeRateService.save(rateNum, manualCurrency, manualDate);
      toast.success(
        `Tasa guardada para ${manualDate}: ${formatRate(rateNum)} ${rateUnit(manualCurrency)}`
      );
      setManualRate("");
      setManualDate(today);
      // Solo refrescamos la tasa activa si la fecha guardada es hoy.
      await Promise.all([
        manualDate === today ? refresh() : Promise.resolve(),
        loadHistory(),
      ]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar la tasa");
    } finally {
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const paged = usePagination(history, 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Tasa de cambio</h1>
        <p className="text-sm text-ios-secondary">
          Las tasas del día se guardan en la base de datos y se usan al registrar pagos en Bs.
        </p>
      </div>

      {/* Tasas vigentes */}
      <div className="grid gap-4 sm:grid-cols-2">
        {(current?.rates.length ? current.rates : [null]).map((r, i) => {
          const isPrimary = r?.currency === current?.primary;
          const savedToday =
            r && history.some((h) => h.date === todayStr && h.currency === r.currency);
          return (
            <Card key={r?.currency ?? i}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-ios-secondary">
                      {r ? `Tasa BCV ${CURRENCY_NAME[r.currency]}` : "Tasa BCV"}
                      {isPrimary && (
                        <span className="ml-2 rounded-full bg-ios-green/10 px-2 py-0.5 text-[10px] font-semibold normal-case text-ios-green">
                          Principal
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-3xl font-bold text-ios-label">
                      {r ? `Bs. ${formatRate(r.rate)}` : "—"}
                    </p>
                    {r && (
                      <p className="mt-1 text-xs text-ios-secondary">
                        Fuente: {r.source} · {savedToday ? "guardada en DB" : "en caché"}
                      </p>
                    )}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Configuración */}
        {config && (
          <Card>
            <CardHeader>
              <p className="text-sm font-semibold text-ios-label">Monedas de cobro</p>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-ios-secondary">
                Las cuotas se cobran en divisas; la moneda decide con qué tasa BCV se convierten a
                Bs. La principal viene preseleccionada al emitir cuotas y valora el saldo a favor.
                Una moneda desactivada deja de consultarse al BCV y no se puede elegir en cuotas
                nuevas; sus cuotas pendientes se siguen cobrando con la última tasa guardada.
              </p>
              {[RateCurrency.USD, RateCurrency.EUR].map((c) => {
                const enabled = config.enabled.includes(c);
                const isPrimary = config.primary === c;
                return (
                  <div
                    key={c}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ios-separator px-4 py-3"
                  >
                    <label className="flex items-center gap-2 text-sm text-ios-label">
                      <input
                        type="checkbox"
                        className="rounded border-ios-separator"
                        checked={enabled}
                        disabled={savingConfig || isPrimary}
                        onChange={() => toggleEnabled(c)}
                      />
                      {CURRENCY_NAME[c]}
                      <span className="text-xs text-ios-secondary">
                        {isPrimary ? "principal" : enabled ? "activa" : "desactivada"}
                      </span>
                    </label>
                    {!isPrimary && enabled && (
                      <Button
                        variant="outline"
                        disabled={savingConfig}
                        onClick={() => void handleSaveConfig({ ...config, primary: c })}
                      >
                        Hacer principal
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}

        {/* Acciones */}
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-ios-label">Registrar tasa</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={handleFetchBcv}
              loading={fetching}
            >
              <RefreshCw className="h-4 w-4" />
              Obtener desde BCV
            </Button>

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-24 shrink-0">
                <Select
                  id="manualCurrency"
                  label="Moneda"
                  value={manualCurrency}
                  onChange={(e) => setManualCurrency(e.target.value as RateCurrency)}
                >
                  <option value={RateCurrency.USD}>USD</option>
                  <option value={RateCurrency.EUR}>EUR</option>
                </Select>
              </div>
              <div className="w-36 shrink-0">
                <Input
                  id="manualDate"
                  label="Fecha"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div className="min-w-[8rem] flex-1">
                <Input
                  id="manualRate"
                  label={`Tasa (${rateUnit(manualCurrency)})`}
                  placeholder="Ej. 67.5000"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  type="number"
                  step="0.0001"
                  min="0.01"
                />
              </div>
              <Button onClick={handleSaveManual} loading={saving} disabled={!manualRate}>
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Historial */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-ios-label">Historial de tasas</h2>
        <Card className="overflow-hidden">
          {loadingHistory ? (
            <TableSkeleton rows={5} cols={5} />
          ) : history.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ios-secondary">Aún no hay tasas guardadas.</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Moneda</th>
                    <th className="px-5 py-3 font-medium">Tasa (Bs)</th>
                    <th className="px-5 py-3 font-medium">Fuente</th>
                    <th className="px-5 py-3 font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ios-separator">
                  {paged.items.map((r) => {
                    const isToday = r.date === todayStr;
                    return (
                      <tr key={r.id} className={isToday ? "bg-brand-50/40" : ""}>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-ios-label">{formatDate(r.date)}</span>
                          {isToday && (
                            <span className="ml-2 inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                              Hoy
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-ios-secondary">{r.currency}</td>
                        <td className="px-5 py-3.5 font-semibold text-ios-label">
                          {formatRate(r.rate)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={
                              r.source === "MANUAL"
                                ? "inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple"
                                : "inline-flex rounded-full bg-ios-green/10 px-2 py-0.5 text-xs font-medium text-ios-green"
                            }
                          >
                            {r.source}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-ios-secondary">
                          {formatDate(r.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loadingHistory && history.length > 0 && (
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              from={paged.from}
              to={paged.to}
              onPageChange={paged.setPage}
              label="tasas"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
