import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ApiError } from "@/services/api";
import {
  ImportPreview,
  ImportPreviewRow,
  ImportResult,
  paymentImportService,
} from "../services/payment-import.service";

interface PaymentImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Se dispara tras importar para que la lista de pagos se recargue. */
  onImported: () => void;
}

function Stat({ value, label, cls }: { value: number | string; label: string; cls: string }) {
  return (
    <div className="rounded-2xl bg-ios-fill px-3 py-2.5 text-center">
      <div className={cn("text-xl font-bold leading-tight", cls)}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-ios-secondary">{label}</div>
    </div>
  );
}

/** Una fila de la planilla con lo que el sistema hará con ella. */
function PreviewRow({ row }: { row: ImportPreviewRow }) {
  const failed = row.errors.length > 0;

  return (
    <li
      className={cn(
        "px-4 py-3",
        failed && "bg-ios-red/[0.06]"
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[11px] text-ios-tertiary">L{row.line}</span>
        <span className="font-medium text-ios-label">{row.codigo || "—"}</span>
        {row.ownerName && (
          <span className="truncate text-xs text-ios-secondary">{row.ownerName}</span>
        )}
        <span className="ml-auto font-semibold text-ios-label">
          {row.amountEur !== null ? formatCurrency(row.amountEur) : "—"}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ios-secondary">
        {row.paymentDate && <span>{formatDate(row.paymentDate)}</span>}
        <span>· {row.currency === "BS" ? "Bolívares" : "Divisas"}</span>
        {row.amountBs !== null && (
          <span>· Bs. {Number(row.amountBs).toLocaleString("es-VE")}</span>
        )}
        {row.modalidad && <span>· {row.modalidad}</span>}
        {row.reference && <span className="font-mono">· {row.reference}</span>}
      </div>

      {/* A qué deuda se imputa */}
      {!failed && row.targetPeriod && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ios-green" />
          <span className="font-medium text-ios-green">
            {formatPeriod(row.targetPeriod)}
          </span>
          {!row.periodExplicit && (
            <span className="text-ios-tertiary">(más antigua pendiente)</span>
          )}
          {row.cascadePeriods.map((p) => (
            <span
              key={p}
              className="rounded-full bg-ios-green/10 px-2 py-0.5 font-medium text-ios-green"
            >
              + {formatPeriod(p)}
            </span>
          ))}
          {row.creditLeft > 0 && (
            <span className="rounded-full bg-ios-purple/10 px-2 py-0.5 font-medium text-ios-purple">
              saldo a favor {formatCurrency(row.creditLeft)}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              row.willAutoConfirm
                ? "bg-ios-green/10 text-ios-green"
                : "bg-ios-orange/10 text-ios-orange"
            )}
          >
            {row.willAutoConfirm ? "se confirmará" : "quedará pendiente"}
          </span>
        </div>
      )}

      {row.errors.map((e) => (
        <p key={e} className="mt-1 text-xs font-medium text-ios-red">
          {e}
        </p>
      ))}
      {row.warnings.map((w) => (
        <p key={w} className="mt-1 text-xs text-ios-orange">
          {w}
        </p>
      ))}
    </li>
  );
}

export function PaymentImportModal({ open, onClose, onImported }: PaymentImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setOnlyErrors(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTemplate = async () => {
    setDownloading(true);
    try {
      await paymentImportService.downloadTemplate();
    } catch {
      toast.error("No se pudo descargar la plantilla");
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Solo se aceptan archivos .xlsx");
      return;
    }
    setFile(f);
    setResult(null);
    setLoading(true);
    try {
      setPreview(await paymentImportService.preview(f));
    } catch (err) {
      setFile(null);
      toast.error(err instanceof ApiError ? err.message : "No se pudo leer la planilla");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await paymentImportService.commit(file);
      setResult(res);
      setPreview(null);
      onImported();
      toast.success(
        `${res.created} pago(s) registrado(s)` +
          (res.confirmed > 0 ? `, ${res.confirmed} confirmado(s)` : "")
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo completar la carga");
    } finally {
      setImporting(false);
    }
  };

  const visibleRows = preview
    ? onlyErrors
      ? preview.rows.filter((r) => r.errors.length > 0)
      : preview.rows
    : [];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Registrar pagos en lote"
      className="w-full sm:max-w-3xl"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {/* --- Paso 3: resultado --- */}
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat value={result.created} label="Pagos creados" cls="text-brand-600" />
            <Stat value={result.confirmed} label="Confirmados" cls="text-ios-green" />
            <Stat
              value={result.failed.length}
              label="Omitidos"
              cls={result.failed.length > 0 ? "text-ios-red" : "text-ios-secondary"}
            />
          </div>

          {result.failed.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-ios-separator">
              <div className="flex items-center gap-2 bg-ios-red/[0.06] px-4 py-2 text-sm font-semibold text-ios-red">
                <AlertTriangle className="h-4 w-4" />
                Filas omitidas ({result.failed.length})
              </div>
              <ul className="max-h-56 divide-y divide-ios-separator overflow-y-auto text-sm">
                {result.failed.map((f) => (
                  <li key={f.line} className="flex flex-wrap gap-x-2 px-4 py-2">
                    <span className="font-mono text-[11px] text-ios-tertiary">L{f.line}</span>
                    <span className="font-medium text-ios-label">{f.codigo || "—"}</span>
                    <span className="text-xs text-ios-red">{f.error}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ios-separator px-4 py-2 text-xs text-ios-secondary">
                Corrige esas filas en la planilla y vuelve a subirla: las ya importadas se
                detectan por su referencia y no se duplicarán.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cargar otra planilla
            </Button>
            <Button onClick={handleClose}>Listo</Button>
          </div>
        </div>
      ) : preview ? (
        /* --- Paso 2: vista previa --- */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={preview.validRows} label="Filas válidas" cls="text-brand-600" />
            <Stat
              value={preview.errorRows}
              label="Con error"
              cls={preview.errorRows > 0 ? "text-ios-red" : "text-ios-secondary"}
            />
            <Stat
              value={formatCurrency(preview.totalEur)}
              label="Total a aplicar"
              cls="text-ios-label"
            />
            <Stat
              value={preview.chargesSettled}
              label="Cuotas que se saldan"
              cls="text-ios-green"
            />
          </div>

          <p className="text-xs text-ios-secondary">
            Nada se ha guardado todavía. La simulación asume que todos los pagos se
            confirman; los marcados como <span className="text-ios-orange">quedará
            pendiente</span> no aparecen aún en el extracto y tendrás que confirmarlos
            desde Pagos.
          </p>

          {preview.errorRows > 0 && (
            <label className="flex items-center gap-2 text-sm text-ios-label">
              <input
                type="checkbox"
                className="rounded border-ios-separator"
                checked={onlyErrors}
                onChange={(e) => setOnlyErrors(e.target.checked)}
              />
              Ver solo las filas con error
            </label>
          )}

          <ul className="max-h-[45vh] divide-y divide-ios-separator overflow-y-auto rounded-2xl border border-ios-separator">
            {visibleRows.map((r) => (
              <PreviewRow key={r.line} row={r} />
            ))}
          </ul>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cambiar planilla
            </Button>
            <Button
              onClick={handleImport}
              loading={importing}
              disabled={preview.validRows === 0}
            >
              Importar {preview.validRows} pago{preview.validRows === 1 ? "" : "s"}
            </Button>
          </div>
          {preview.errorRows > 0 && (
            <p className="text-right text-xs text-ios-secondary">
              Las {preview.errorRows} filas con error se omitirán.
            </p>
          )}
        </div>
      ) : (
        /* --- Paso 1: elegir archivo --- */
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-ios-secondary">
            <p>
              Descarga la plantilla, llénala con los pagos y súbela. Verás una vista
              previa de qué cuota salda cada fila antes de guardar nada.
            </p>
            <ul className="space-y-1 text-xs">
              <li>· <strong>Modalidad</strong> solo admite Efectivo o Transferencia (no es el banco).</li>
              <li>· Si indicas el <strong>período</strong>, el pago se imputa a esa cuota.</li>
              <li>· Si lo dejas vacío, va a la cuota pendiente más antigua.</li>
              <li>· El excedente cierra las siguientes cuotas y lo que sobre queda como saldo a favor.</li>
              <li>· Si la referencia ya está en el extracto y el monto cuadra, el pago se confirma solo.</li>
            </ul>
          </div>

          <Button
            variant="outline"
            onClick={handleTemplate}
            loading={downloading}
            className="w-full"
          >
            <Download className="h-4 w-4" />
            Descargar plantilla
          </Button>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed",
              "border-ios-separator px-4 py-8 text-center transition-colors",
              "hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-50"
            )}
          >
            {loading ? (
              <>
                <FileSpreadsheet className="h-7 w-7 animate-pulse text-brand-600" />
                <span className="text-sm font-medium text-ios-label">
                  Analizando {file?.name}…
                </span>
              </>
            ) : (
              <>
                <Upload className="h-7 w-7 text-ios-secondary" />
                <span className="text-sm font-medium text-ios-label">
                  Subir planilla llena (.xlsx)
                </span>
                <span className="text-xs text-ios-secondary">
                  Se analiza primero; no se guarda nada hasta que confirmes
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}
