import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Receipt, Trash2 } from "lucide-react";
import { Payment, PaymentStatus } from "@/types/domain";
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

  const handleDownload = async (payment: Payment) => {
    const firstReceipt = payment.receipts?.[0];
    if (!firstReceipt) return;
    setBusyId(payment.id);
    try {
      await paymentService.downloadReceipt(payment.id, firstReceipt.receiptNumber);
      toast.success("Recibo descargado");
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pagos</h1>
        <p className="text-sm text-slate-500">Historial completo de pagos registrados por copropietarios</p>
      </div>

      {/* Tabs de filtro */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.value
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{p.submittedBy?.fullName ?? "—"}</div>
                      <div className="text-xs text-slate-400">C.I. {p.submittedBy?.cedula ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-700">
                        {p.charge ? formatPeriod(p.charge.period) : "—"}
                      </div>
                      <div className="text-xs text-slate-400">{p.property?.code ?? "—"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-700">{formatCurrency(p.amount)}</div>
                      {p.amountBs && (
                        <div className="text-xs text-slate-400">Bs. {Number(p.amountBs).toLocaleString("es-VE")}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-mono text-xs text-slate-700">{p.reference}</div>
                      <div className="text-xs text-slate-400">{p.bank}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                      {p.status === PaymentStatus.REJECTED && p.rejectReason && (
                        <div className="mt-1 text-xs text-rose-500">{p.rejectReason}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {p.status === PaymentStatus.CONFIRMED && p.receipts?.[0] ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(p)}
                            disabled={busyId === p.id}
                          >
                            {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </Button>
                        ) : p.status === PaymentStatus.PENDING ? (
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
                          className="text-rose-400 hover:bg-rose-50 hover:text-rose-600"
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
