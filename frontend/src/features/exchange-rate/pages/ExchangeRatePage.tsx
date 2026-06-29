import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatRate, formatDate } from "@/lib/format";
import { useExchangeRate } from "../hooks/useExchangeRate";
import { exchangeRateService, ExchangeRateRecord } from "../services/exchange-rate.service";
import { ApiError } from "@/services/api";

export function ExchangeRatePage() {
  const { data: current, refresh } = useExchangeRate();
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
  }, [loadHistory]);

  const handleFetchBcv = async () => {
    setFetching(true);
    try {
      const rate = await exchangeRateService.fetchFromBcv();
      toast.success(`Tasa BCV actualizada: Bs. ${formatRate(rate.rate)}/EUR`);
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
      await exchangeRateService.save(rateNum, manualDate);
      toast.success(`Tasa guardada para ${manualDate}: Bs. ${formatRate(rateNum)}/EUR`);
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
  const todayRecord = history.find((r) => r.date === todayStr);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tasa de cambio</h1>
        <p className="text-sm text-slate-500">
          La tasa del día se guarda en la base de datos y se usa al registrar pagos en Bs.
        </p>
      </div>

      {/* Tasa actual */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Tasa activa hoy
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {current ? `Bs. ${formatRate(current.rate)}` : "—"}
                </p>
                {current && (
                  <p className="mt-1 text-xs text-slate-500">
                    Fuente: {current.source} · {todayRecord ? "guardada en DB" : "en caché"}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Acciones */}
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-slate-700">Registrar tasa</p>
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

            <div className="flex items-end gap-2">
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
              <div className="flex-1">
                <Input
                  id="manualRate"
                  label="Tasa (Bs/EUR)"
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
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Historial de tasas</h2>
        <Card className="overflow-hidden">
          {loadingHistory ? (
            <TableSkeleton rows={5} cols={4} />
          ) : history.length === 0 ? (
            <CardBody>
              <p className="text-sm text-slate-400">Aún no hay tasas guardadas.</p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Tasa (Bs/EUR)</th>
                    <th className="px-5 py-3 font-medium">Fuente</th>
                    <th className="px-5 py-3 font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((r) => {
                    const isToday = r.date === todayStr;
                    return (
                      <tr key={r.id} className={isToday ? "bg-brand-50/40" : ""}>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-slate-800">{formatDate(r.date)}</span>
                          {isToday && (
                            <span className="ml-2 inline-flex rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                              Hoy
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700">
                          {formatRate(r.rate)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={
                              r.source === "MANUAL"
                                ? "inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-500/20"
                                : "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20"
                            }
                          >
                            {r.source}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {formatDate(r.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
