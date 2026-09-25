import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Receipt, Search, Trash2, Upload, X } from "lucide-react";
import { Payment, PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { StatusBadge } from "../components/StatusBadge";
import { PaymentImportModal } from "../components/PaymentImportModal";
import { paymentService } from "../services/payment.service";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/cn";
import { chargeLabel, coveredCharges } from "@/features/payments/coveredCharges";

const TABS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Pendientes", value: PaymentStatus.PENDING },
  { label: "Confirmados", value: PaymentStatus.CONFIRMED },
  { label: "Rechazados", value: PaymentStatus.REJECTED },
];

/** Sin tildes y en minúsculas: buscar "perez" debe encontrar "Pérez". */
function norm(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Texto sobre el que busca el filtro: todo lo que la fila muestra y que el
 * admin podría teclear — nombre, cédula, departamento, referencia, banco y el
 * período tanto en letras ("septiembre") como en número ("2026-09").
 */
function searchableText(p: Payment): string {
  return norm(
    [
      p.submittedBy?.fullName,
      p.submittedBy?.cedula,
      p.property?.code,
      p.reference,
      p.bank,
      p.charge?.period,
      p.charge ? formatPeriod(p.charge.period) : null,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * Cuotas del pago además de la suya: las que el vecino eligió pagar juntas y
 * las que cerró el excedente en cascada.
 */
function CoveredCharges({ payment }: { payment: Payment }) {
  const extra = coveredCharges(payment).filter((c) => c.id !== payment.charge?.id);

  if (extra.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {extra.map((c) => (
        <div key={c.id} className="text-xs font-medium text-ios-green">
          + {chargeLabel(c)}
        </div>
      ))}
    </div>
  );
}

export function AllPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Payment | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      setPayments(await paymentService.listAll(status || undefined));
    } catch {
      toast.error("No se pudieron cargar los pagos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  /** Varias palabras se exigen todas, en cualquier orden: "gori septiembre". */
  const filtered = useMemo(() => {
    const terms = norm(search).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return payments;
    return payments.filter((p) => {
      const haystack = searchableText(p);
      return terms.every((t) => haystack.includes(t));
    });
  }, [payments, search]);

  const paged = usePagination(filtered, 25);

  const handleConfirm = async (payment: Payment) => {
    setBusyId(payment.id);
    try {
      await paymentService.confirm(payment.id);
      toast.success("Pago confirmado");
      void load(tab);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectConfirm = async (reason?: string) => {
    if (!rejectTarget || !reason) return;
    setBusyId(rejectTarget.id);
    setRejectTarget(null);
    try {
      await paymentService.reject(rejectTarget.id, reason);
      toast.success("Pago rechazado");
      void load(tab);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo rechazar");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await paymentService.delete(deleteTarget.id);
      toast.success("Pago eliminado");
      void load(tab);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight text-ios-label">Pagos</h1>
          <p className="text-sm text-ios-secondary">Historial completo de pagos registrados por copropietarios</p>
        </div>
        <Button
          size="sm"
          className="shrink-0 sm:h-11 sm:px-5 sm:text-[15px]"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Registrar pagos
          <span className="hidden sm:inline">&nbsp;en lote</span>
        </Button>
      </div>

      {/* Filtros: pestañas de estado + buscador. El borde va en el contenedor
          para que cruce todo el ancho aunque el buscador se ponga al lado. */}
      <div className="flex flex-col gap-2 border-b border-ios-separator sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {/* Desbordan en móvil, así que scrollean dentro de su fila */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === t.value
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-ios-secondary hover:text-ios-label"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative pb-2 sm:pb-1.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ios-secondary" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar copropietario, depa, referencia…"
            aria-label="Buscar pagos"
            className="h-9 w-full rounded-xl border-0 bg-ios-fill pl-8 pr-8 text-sm text-ios-label placeholder:text-ios-secondary focus:outline-none focus:ring-2 focus:ring-brand-500/70 sm:w-72"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ios-secondary hover:text-ios-label"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Card className="overflow-hidden">
          <TableSkeleton rows={5} cols={5} />
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="Sin pagos"
            description="No hay pagos en esta categoría."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="Sin coincidencias"
            description={`Ningún pago de esta categoría coincide con "${search}".`}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Vista móvil: tarjetas. La tabla de 7 columnas no cabe en un teléfono. */}
          <div className="divide-y divide-ios-separator sm:hidden">
            {paged.items.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ios-label">
                      {p.submittedBy?.fullName ?? "—"}
                    </div>
                    <div className="text-xs text-ios-secondary">
                      {p.charge ? formatPeriod(p.charge.period) : "—"} · {p.property?.code ?? "—"}
                    </div>
                    <CoveredCharges payment={p} />
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-ios-label">{formatCurrency(p.amount)}</p>
                    {p.amountBs && (
                      <p className="text-xs text-ios-secondary">
                        Bs. {Number(p.amountBs).toLocaleString("es-VE")}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="truncate font-mono text-xs text-ios-label">{p.reference}</p>
                    <p className="truncate text-xs text-ios-secondary">{p.bank}</p>
                    <p className="text-xs text-ios-secondary">{formatDate(p.paymentDate)}</p>
                  </div>
                </div>

                {p.status === PaymentStatus.REJECTED && p.rejectReason && (
                  <p className="mt-2 text-xs text-ios-red">{p.rejectReason}</p>
                )}

                <div className="mt-3 flex gap-2">
                  {p.status === PaymentStatus.PENDING && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        className="flex-1 justify-center"
                        onClick={() => handleConfirm(p)}
                        disabled={busyId === p.id}
                      >
                        {busyId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Confirmar"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1 justify-center"
                        onClick={() => setRejectTarget(p)}
                        disabled={busyId === p.id}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(p)}
                    disabled={busyId === p.id}
                    title="Eliminar pago"
                    className={cn(
                      "text-ios-red hover:bg-ios-red/10 hover:text-ios-red",
                      p.status !== PaymentStatus.PENDING && "flex-1 justify-center"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {p.status !== PaymentStatus.PENDING && "Eliminar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Vista escritorio: tabla */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
                <tr>
                  <th className="px-5 py-3 font-medium">Copropietario</th>
                  <th className="px-5 py-3 font-medium">Período / Depa</th>
                  <th className="px-5 py-3 font-medium">Monto</th>
                  <th className="px-5 py-3 font-medium">Referencia</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ios-separator">
                {paged.items.map((p) => (
                  <tr key={p.id} className="hover:bg-ios-fill">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-ios-label">{p.submittedBy?.fullName ?? "—"}</div>
                      <div className="text-xs text-ios-secondary">C.I. {p.submittedBy?.cedula ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-ios-label">
                        {p.charge ? formatPeriod(p.charge.period) : "—"}
                      </div>
                      <div className="text-xs text-ios-secondary">{p.property?.code ?? "—"}</div>
                      <CoveredCharges payment={p} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-ios-label">{formatCurrency(p.amount)}</div>
                      {p.amountBs && (
                        <div className="text-xs text-ios-secondary">Bs. {Number(p.amountBs).toLocaleString("es-VE")}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs text-ios-label">{p.reference}</div>
                      <div className="text-xs text-ios-secondary">{p.bank}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ios-secondary">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                      {p.status === PaymentStatus.REJECTED && p.rejectReason && (
                        <div className="mt-1 text-xs text-ios-red">{p.rejectReason}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {p.status === PaymentStatus.PENDING ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleConfirm(p)}
                              disabled={busyId === p.id}
                            >
                              {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setRejectTarget(p)}
                              disabled={busyId === p.id}
                            >
                              Rechazar
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(p)}
                          disabled={busyId === p.id}
                          title="Eliminar pago"
                          className="text-ios-red hover:bg-ios-red/10 hover:text-ios-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            label="pagos"
          />
          {search && (
            <div className="border-t border-ios-separator px-4 py-2 text-xs text-ios-secondary">
              Mostrando {filtered.length} de {payments.length} pagos
            </div>
          )}
        </Card>
      )}
    </div>

    <PaymentImportModal
      open={importOpen}
      onClose={() => setImportOpen(false)}
      onImported={() => void load(tab)}
    />

    <ConfirmDialog
      open={deleteTarget !== null}
      onClose={() => setDeleteTarget(null)}
      onConfirm={handleDeleteConfirm}
      title="Eliminar pago"
      description={`¿Eliminar el pago de ${deleteTarget?.submittedBy?.fullName ?? "este copropietario"}? Si estaba confirmado, la cuota volverá a su estado anterior.`}
      confirmLabel="Eliminar"
      loading={busyId === deleteTarget?.id}
    />

    <ConfirmDialog
      open={rejectTarget !== null}
      onClose={() => setRejectTarget(null)}
      onConfirm={handleRejectConfirm}
      title="Rechazar pago"
      description={`Indica el motivo del rechazo del pago de ${rejectTarget?.submittedBy?.fullName ?? ""}.`}
      confirmLabel="Rechazar"
      loading={busyId === rejectTarget?.id}
      prompt={{ label: "Motivo del rechazo", placeholder: "Ej. Referencia no encontrada", required: true }}
    />
    </>
  );
}
