import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, AlertTriangle, XCircle, Upload,
  Loader2, Database, Search, X, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import {
  reconciliationService,
  ReconciliationResult,
  ConfirmedMatch,
  ReviewMatch,
  UnmatchedRow,
  BankEntry,
} from "../services/reconciliation.service";
import { paymentService } from "@/features/payments/services/payment.service";
import { formatDate } from "@/lib/format";

function formatAmt(n: number) {
  return Number(n).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ResultSection<T>({
  title, icon, color, items, renderRow, cols,
}: {
  title: string; icon: ReactNode; color: string;
  items: T[]; renderRow: (item: T, i: number) => React.ReactNode; cols: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 font-semibold", color)}>
        {icon}{title} ({items.length})
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{cols.map((c) => <th key={c} className="px-4 py-2.5 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, i) => renderRow(item, i))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function BankStatementPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Entradas guardadas en DB
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Selección
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      setEntries(await reconciliationService.listEntries());
      setSelected(new Set());
    } catch {
      // silencioso — la tabla sigue vacía
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const filteredEntries = useMemo(() =>
    entries.filter((e) => {
      const matchRef = search === "" || e.referencia.toLowerCase().includes(search.toLowerCase());
      const matchDate = filterDate === "" || e.fecha === filterDate;
      return matchRef && matchDate;
    }),
  [entries, search, filterDate]);

  const toggleOne = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === filteredEntries.length ? new Set() : new Set(filteredEntries.map((e) => e.id))
    );

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await reconciliationService.deleteEntries([...selected]);
      toast.success(`${selected.size} entrada(s) eliminada(s)`);
      void loadEntries();
    } catch {
      toast.error("No se pudieron eliminar las entradas");
    } finally {
      setDeleting(false);
    }
  };

  const handleFileSelect = (f: File) => {
    if (!f.name.endsWith(".xlsx")) { toast.error("Solo se aceptan archivos .xlsx"); return; }
    void handleProcess(f);
  };

  const handleProcess = async (f: File) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await reconciliationService.reconcile(f);
      setResult(res);
      void loadEntries();
      if (res.confirmed.length > 0)
        toast.success(`${res.confirmed.length} pago(s) confirmado(s) automáticamente`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error al procesar el extracto");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFull = async (m: ReviewMatch) => {
    setBusyId(m.paymentId);
    try {
      await paymentService.confirm(m.paymentId);
      toast.success("Pago confirmado");
      setResult((r) => r && {
        ...r,
        review: r.review.filter((x) => x.paymentId !== m.paymentId),
        confirmed: [...r.confirmed, m],
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally { setBusyId(null); }
  };

  const handleConfirmPartial = async (m: ReviewMatch) => {
    setBusyId(m.paymentId);
    try {
      await paymentService.confirmPartial(m.paymentId, m.bankAmount);
      toast.success(`Confirmado parcial: ${formatAmt(m.bankAmount)}`);
      setResult((r) => r && {
        ...r,
        review: r.review.filter((x) => x.paymentId !== m.paymentId),
        confirmed: [...r.confirmed, m],
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar parcialmente");
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado + botón subir */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Extracto bancario</h1>
          <p className="text-sm text-slate-500">
            Sube el extracto del banco (.xlsx) para conciliar automáticamente los pagos pendientes
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileSelect(f); e.target.value = ""; } }}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Procesando..." : "Subir movimientos"}
          </Button>
        </div>
      </div>

      {/* Resultado del último proceso */}
      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Filas totales",    value: result.totalRows,          cls: "text-slate-700" },
              { label: "Entradas nuevas",  value: result.newEntries,         cls: "text-brand-600" },
              { label: "Duplicadas",       value: result.duplicates,         cls: "text-slate-400" },
              { label: "Confirmados",      value: result.confirmed.length,   cls: "text-emerald-600" },
              { label: "Por revisar",      value: result.review.length,      cls: "text-amber-600" },
            ].map((s) => (
              <Card key={s.label} className="p-4 text-center">
                <div className={cn("text-2xl font-bold", s.cls)}>{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </Card>
            ))}
          </div>

          <ResultSection<ConfirmedMatch>
            title="Confirmados automáticamente" icon={<CheckCircle2 className="h-5 w-5" />}
            color="text-emerald-600" items={result.confirmed}
            cols={["Referencia", "Monto banco", "Fecha", "Copropietario", "Depa"]}
            renderRow={(m, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-mono text-xs">{m.bankRef}</td>
                <td className="px-4 py-2.5 text-slate-700">{formatAmt(m.bankAmount)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{m.bankDate ? formatDate(m.bankDate) : "—"}</td>
                <td className="px-4 py-2.5">{m.ownerName}</td>
                <td className="px-4 py-2.5">{m.propertyCode}</td>
              </tr>
            )}
          />

          {result.review.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-600">
                <AlertTriangle className="h-5 w-5" />Por revisar ({result.review.length})
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {["Referencia", "Monto banco", "Copropietario", "Depa", "Motivo", "Acciones"].map((c) => (
                          <th key={c} className={cn("px-4 py-2.5 font-medium", c === "Acciones" && "text-right")}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.review.map((m, i) => (
                        <tr key={i} className="hover:bg-amber-50/40">
                          <td className="px-4 py-2.5 font-mono text-xs">{m.bankRef}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-700">{formatAmt(m.bankAmount)}</td>
                          <td className="px-4 py-2.5">{m.ownerName}</td>
                          <td className="px-4 py-2.5">{m.propertyCode}</td>
                          <td className="px-4 py-2.5 text-xs text-amber-700 max-w-[180px]">{m.reason}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="success" disabled={busyId === m.paymentId}
                                onClick={() => handleConfirmFull(m)} title="Confirmar como pago completo">
                                {busyId === m.paymentId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                              </Button>
                              <Button size="sm" variant="outline" disabled={busyId === m.paymentId}
                                onClick={() => handleConfirmPartial(m)}
                                title={`Usar monto banco (${formatAmt(m.bankAmount)}) — cuota queda PARCIAL`}>
                                Parcial
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          <ResultSection<UnmatchedRow>
            title="Sin coincidencia" icon={<XCircle className="h-5 w-5" />}
            color="text-slate-400" items={result.unmatched}
            cols={["Referencia", "Monto", "Fecha", "Descripción"]}
            renderRow={(m, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.bankRef}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatAmt(m.bankAmount)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{m.bankDate ? formatDate(m.bankDate) : "—"}</td>
                <td className="px-4 py-2.5 text-xs text-slate-400 max-w-xs truncate">{m.bankDesc ?? "—"}</td>
              </tr>
            )}
          />
        </div>
      )}

      {/* Todas las entradas guardadas en DB */}
      <div className="space-y-3">
        {/* Cabecera con conteo y filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-slate-700">
              <Database className="h-5 w-5" />
              Entradas bancarias guardadas ({entries.length})
            </div>
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                loading={deleting}
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar ({selected.size})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Buscador por referencia */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar referencia…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-48 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Filtro de fecha */}
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={cn(
                  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100",
                  filterDate ? "border-brand-400 text-brand-700" : ""
                )}
              />
            </div>
            {filterDate && (
              <button onClick={() => setFilterDate("")} className="text-xs text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loadingEntries ? (
          <Card className="overflow-hidden"><TableSkeleton rows={4} cols={5} /></Card>
        ) : entries.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-400">
            Aún no se han subido extractos. Las entradas aparecerán aquí después de procesar un archivo.
          </Card>
        ) : filteredEntries.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-400">
            No hay entradas que coincidan con los filtros aplicados.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected.size === filteredEntries.length && filteredEntries.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Referencia</th>
                    <th className="px-4 py-2.5 font-medium">Monto</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Descripción</th>
                    <th className="px-4 py-2.5 font-medium">Subida</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((e) => (
                    <tr key={e.id} className={cn("hover:bg-slate-50/60 cursor-pointer", e.matched && "bg-emerald-50/40", selected.has(e.id) && "bg-brand-50/60")}
                      onClick={() => toggleOne(e.id)}>
                      <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" className="rounded border-slate-300"
                          checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{e.referencia}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{formatAmt(e.monto)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{e.fecha ? formatDate(e.fecha) : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-xs truncate">{e.descripcion ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{formatDate(e.uploadedAt)}</td>
                      <td className="px-4 py-2.5">
                        {e.matched ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Casado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                            Libre
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(search || filterDate) && (
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                Mostrando {filteredEntries.length} de {entries.length} entradas
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
