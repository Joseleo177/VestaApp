import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface PaymentHistoryTableProps {
  payments: Payment[];
  loading: boolean;
}

export function PaymentHistoryTable({ payments, loading }: PaymentHistoryTableProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        <TableSkeleton rows={4} cols={4} />
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
      {/* Vista móvil: tarjetas */}
      <div className="sm:hidden divide-y divide-slate-100">
        {payments.map((payment) => (
          <div key={payment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {payment.charge ? formatPeriod(payment.charge.period) : "—"}
                </p>
                <p className="text-xs text-slate-400">{formatDate(payment.paymentDate)}</p>
              </div>
              <StatusBadge status={payment.status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(payment.amount)}</p>
                <p className="text-xs text-slate-400">
                  {payment.currency === PaymentCurrency.BS && payment.amountBs
                    ? `Bs. ${payment.amountBs.toLocaleString("es-VE")}`
                    : "Divisas (€)"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">{payment.reference}</p>
                <p className="text-xs text-slate-400">{payment.bank}</p>
              </div>
            </div>
            {payment.status === PaymentStatus.REJECTED && payment.rejectReason && (
              <p className="mt-2 text-xs text-rose-500">{payment.rejectReason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Referencia</th>
              <th className="px-5 py-3 font-medium">Estado</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
