import { DragEvent, ReactNode, useRef, useState } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Money } from "@/components/ui/Money";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EntryFilter, useBankStatement } from "../hooks/useBankStatement";
import { EntriesTable } from "../components/EntriesTable";
import { bs, ReconciliationResultModal } from "../components/ReconciliationResultModal";

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="min-w-0 px-5 py-4">
      <p className="text-[12px] text-ios-secondary">{label}</p>
      <div className="mt-0.5 truncate text-[22px] font-bold leading-tight text-ios-label">{children}</div>
      {sub && <div className="mt-1 text-[12px] text-ios-secondary">{sub}</div>}
    </Card>
  );
}

/** Extracto bancario: subir movimientos y conciliarlos contra los pagos reportados. */
export function BankStatementPage() {
  const s = useBankStatement();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pickFile = () => inputRef.current?.click();
  const matchedPct = s.summary.total ? Math.round((s.summary.matched / s.summary.total) * 100) : 0;
  const selectedTotal = s.selectedEntries.reduce((sum, e) => sum + Number(e.monto), 0);
  const selectedMatched = s.selectedEntries.filter((e) => e.matched).length;

  // Soltar el .xlsx en cualquier parte de la página, además del botón.
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void s.upload(file);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
      className="relative"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void s.upload(f);
          e.target.value = "";
        }}
      />

      <Page
        module="Día a día"
        title="Extracto bancario"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={s.reconcilePending}
              loading={s.reconciling}
              title="Cruza los pagos por validar contra los movimientos ya guardados"
            >
              {!s.reconciling && <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Conciliar pendientes</span>
              <span className="sm:hidden">Conciliar</span>
            </Button>
            <Button size="sm" onClick={pickFile} loading={s.uploading}>
              {!s.uploading && <Upload className="h-4 w-4" />}
              {s.uploading ? "Procesando…" : <><span className="hidden sm:inline">Subir extracto</span><span className="sm:hidden">Subir</span></>}
            </Button>
          </>
        }
        subheader={
          <p className="text-[14px] text-ios-secondary">
            Sube el extracto del banco en .xlsx (o suéltalo aquí): los pagos cuya referencia y monto coinciden se confirman solos.
          </p>
        }
      >
        {/* ── Resumen ── */}
        {s.loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[92px] w-full !rounded-2xl" />
            ))}
          </div>
        ) : (
          s.summary.total > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Movimientos guardados">{s.summary.total}</Stat>
              <Stat
                label="Conciliados"
                sub={
                  <div className="h-1.5 overflow-hidden rounded-full bg-ios-fill" aria-hidden>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${matchedPct}%` }} />
                  </div>
                }
              >
                {s.summary.matched} <span className="text-[14px] font-medium text-ios-secondary">· {matchedPct}%</span>
              </Stat>
              <Stat label="Sin conciliar" sub={<Money value={bs(s.summary.freeAmount)} />}>
                {s.summary.free}
              </Stat>
              <Stat label="Último extracto">
                {s.summary.lastUpload ? formatDate(s.summary.lastUpload) : "—"}
              </Stat>
            </div>
          )
        )}

        {/* El resultado del último proceso sigue a mano después de cerrar el modal. */}
        {s.result && !s.resultOpen && (
          <button
            type="button"
            onClick={() => s.setResultOpen(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[13px] transition-colors",
              s.result.review.length
                ? "border-amber-500/30 bg-amber-500/[0.07] text-amber-800 hover:bg-amber-500/[0.11] dark:text-amber-300"
                : "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-800 hover:bg-emerald-500/[0.1] dark:text-emerald-300"
            )}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Último extracto: {s.result.confirmed.length} confirmados
              {s.result.review.length > 0 && ` · ${s.result.review.length} por revisar`}
            </span>
            <span className="font-semibold">Ver resultado</span>
          </button>
        )}

        {/* ── Movimientos ── */}
        {!s.loading && s.summary.total === 0 ? (
          <button
            type="button"
            onClick={pickFile}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-ios-separator px-6 py-16 text-center transition-colors hover:border-brand-500/50 hover:bg-brand-50/40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/[0.12] text-rose-600 dark:text-rose-400">
              <FileSpreadsheet className="h-7 w-7" />
            </span>
            <span className="text-[16px] font-semibold text-ios-label">Sube tu primer extracto</span>
            <span className="max-w-sm text-[13px] text-ios-secondary">
              Arrastra aquí el archivo .xlsx que descargas de la banca en línea, o toca para elegirlo.
            </span>
          </button>
        ) : (
          <Card className="overflow-hidden">
            {/* Barra de selección: reemplaza a los filtros mientras haya algo marcado. */}
            {s.selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-3 border-b border-ios-separator bg-brand-50/60 px-4 py-3">
                <p className="text-[13px] text-ios-label">
                  <span className="font-semibold">{s.selected.size}</span>{" "}
                  {s.selected.size === 1 ? "movimiento seleccionado" : "movimientos seleccionados"} ·{" "}
                  <Money value={bs(selectedTotal)} className="font-semibold" />
                </p>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" className="!h-8" onClick={s.clearSelection}>
                    <X className="h-4 w-4" />
                    Quitar selección
                  </Button>
                  <Button size="sm" variant="danger" className="!h-8" onClick={() => s.setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-b border-ios-separator p-4 xl:flex-row xl:items-end">
                <Segmented<EntryFilter>
                  aria-label="Estado del movimiento"
                  value={s.status}
                  onChange={s.setStatus}
                  options={[
                    { key: "all", label: "Todos", count: s.summary.total },
                    { key: "free", label: "Sin conciliar", count: s.summary.free },
                    { key: "matched", label: "Conciliados", count: s.summary.matched },
                  ]}
                  className="self-start"
                />
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:ml-auto xl:max-w-[640px]">
                  <SearchField
                    value={s.search}
                    onChange={s.setSearch}
                    placeholder="Referencia, monto o descripción"
                    className="col-span-2 self-end sm:col-span-1 [&_input]:h-11"
                    hotkey
                  />
                  <DatePicker
                    value={s.dateFrom}
                    onChange={s.setDateFrom}
                    placeholder="Desde"
                    shortcuts={[{ label: "Quitar", value: "" }]}
                  />
                  <DatePicker
                    value={s.dateTo}
                    onChange={s.setDateTo}
                    placeholder="Hasta"
                    shortcuts={[{ label: "Quitar", value: "" }]}
                  />
                </div>
              </div>
            )}

            {s.hasFilters && !s.loading && (
              <div className="flex items-center justify-between border-b border-ios-separator px-5 py-2 text-[12px] text-ios-secondary">
                <span>
                  {s.filtered.length} de {s.summary.total} movimientos
                </span>
                <button type="button" onClick={s.clearFilters} className="font-semibold text-brand-600 hover:underline">
                  Quitar filtros
                </button>
              </div>
            )}

            <EntriesTable
              entries={s.paged.items}
              loading={s.loading}
              hasFilters={s.hasFilters}
              onClear={s.clearFilters}
              selected={s.selected}
              allSelected={s.allSelected}
              onToggle={s.toggle}
              onToggleAll={s.toggleAll}
            />

            <Pagination
              page={s.paged.page}
              totalPages={s.paged.totalPages}
              total={s.paged.total}
              from={s.paged.from}
              to={s.paged.to}
              onPageChange={s.paged.setPage}
              label="movimientos"
            />
          </Card>
        )}
      </Page>

      {/* Velo al arrastrar un archivo sobre la página. */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-600/10 p-6 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand-500 bg-ios-card px-10 py-8 shadow-ios-lg">
            {s.uploading ? <Loader2 className="h-8 w-8 animate-spin text-brand-600" /> : <Upload className="h-8 w-8 text-brand-600" />}
            <p className="text-[16px] font-semibold text-ios-label">Suelta el extracto para procesarlo</p>
            <p className="text-[13px] text-ios-secondary">Archivo .xlsx de la banca en línea</p>
          </div>
        </div>
      )}

      <ReconciliationResultModal
        open={s.resultOpen}
        onClose={() => s.setResultOpen(false)}
        result={s.result}
        busyId={s.busyId}
        onConfirmFull={s.confirmFull}
        onConfirmPartial={s.confirmPartial}
      />

      <ConfirmDialog
        open={s.confirmDelete}
        onClose={() => s.setConfirmDelete(false)}
        onConfirm={s.remove}
        loading={s.deleting}
        title={`¿Eliminar ${s.selected.size} ${s.selected.size === 1 ? "movimiento" : "movimientos"}?`}
        description={
          selectedMatched > 0
            ? `${selectedMatched} ya ${selectedMatched === 1 ? "está conciliado" : "están conciliados"}: sus pagos siguen confirmados, solo se borra el movimiento del banco.`
            : "Se borran del registro del banco. Si vuelves a subir el mismo extracto, se cargarán de nuevo."
        }
        confirmLabel="Eliminar"
      />

      {s.settledDialog}
    </div>
  );
}
