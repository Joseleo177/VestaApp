import { useState } from "react";
import { Download, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { paymentService } from "../services/payment.service";
import { ApiError } from "@/services/api";

interface PaymentHistoryTableProps {
  payments: Payment[];
  loading: boolean;
}

/** Historial interactivo de alícuotas y pagos del copropietario. */
export function PaymentHistoryTable({ payments, loading }: PaymentHistoryTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (payment: Payment) => {
    if (!payment.receipt) return;
    setDownloadingId(payment.id);
    try {
      await paymentService.downloadReceipt(payment.id, payment.receipt.receiptNumber);
      toast.success("Recibo descargado");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo descargar el recibo";
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={4} cols={5} />
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="Aún no registras pagos"
          description="Cuando registres un pago aparecerá aquí con su estado."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Referencia</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 text-right font-medium">Recibo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-800">
                    {payment.charge ? formatPeriod(payment.charge.period) : "—"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatDate(payment.paymentDate)}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-700">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {payment.currency === PaymentCurrency.BS && payment.amountBs
                      ? `Bs. ${payment.amountBs.toLocaleString("es-VE")}`
                      : "Divisas (€)"}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="text-slate-700">{payment.reference}</div>
                  <div className="text-xs text-slate-400">{payment.bank}</div>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={payment.status} />
                  {payment.status === PaymentStatus.REJECTED && payment.rejectReason && (
                    <div className="mt-1 text-xs text-rose-500">{payment.rejectReason}</div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {payment.status === PaymentStatus.CONFIRMED && payment.receipt ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(payment)}
                      disabled={downloadingId === payment.id}
                    >
                      {downloadingId === payment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      PDF
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-300">No disponible</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
