import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Receipt, Trash2 } from "lucide-react";
import { Charge, Payment, PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "../components/StatusBadge";
import { paymentService } from "../services/payment.service";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { ApiError } from "@/services/api";
import { cn } from "@/lib/cn";

const TABS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Pendientes", value: PaymentStatus.PENDING },
  { label: "Confirmados", value: PaymentStatus.CONFIRMED },
  { label: "Rechazados", value: PaymentStatus.REJECTED },
];

/**
 * Cuotas que saldó el pago además de la suya: cuando el monto excede la cuota
 * elegida, el excedente cierra otras en cascada y cada una emite su recibo.
 */
function CoveredCharges({ payment }: { payment: Payment }) {
  const extra = (payment.receipts ?? [])
    .map((r) => r.charge)
    .filter((c): c is Charge => !!c && c.id !== payment.charge?.id);

  if (extra.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {extra.map((c) => (
        <div key={c.id} className="text-xs font-medium text-ios-green">
          + saldó {formatPeriod(c.period)}
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
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Pagos</h1>
        <p className="text-sm text-ios-secondary">Historial completo de pagos registrados por copropietarios</p>
      </div>

      {/* Tabs de filtro — desbordan en móvil, así que scrollean dentro de su fila */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ios-separator">
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
      ) : (
        <Card className="overflow-hidden">
          {/* Vista móvil: tarjetas. La tabla de 7 columnas no cabe en un teléfono. */}
          <div className="divide-y divide-ios-separator sm:hidden">
            {payments.map((p) => (
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
                {payments.map((p) => (
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
        </Card>
      )}
    </div>

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
