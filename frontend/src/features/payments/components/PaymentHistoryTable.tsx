import { useMemo } from "react";
import { Payment, PaymentCurrency, PaymentStatus } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate, formatPeriod } from "@/lib/format";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { StatusBadge } from "./StatusBadge";

interface PaymentHistoryTableProps {
  payments: Payment[];
  loading: boolean;
}

export function PaymentHistoryTable({ payments, loading }: PaymentHistoryTableProps) {
  const { user } = useAuth();

  // El historial incluye las unidades donde el usuario es autorizado, así que
  // se identifica el departamento y quién registró cada pago cuando no fue él.
  const showUnit = useMemo(
    () => new Set(payments.map((p) => p.property?.id ?? "")).size > 1,
    [payments]
  );

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
      <div className="sm:hidden divide-y divide-ios-separator">
        {payments.map((payment) => (
          <div key={payment.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ios-label">
                  {payment.charge ? formatPeriod(payment.charge.period) : "—"}
                </p>
                <p className="text-xs text-ios-secondary">{formatDate(payment.paymentDate)}</p>
                {showUnit && payment.property && (
                  <p className="text-xs font-medium text-brand-600">{payment.property.code}</p>
                )}
              </div>
              <StatusBadge status={payment.status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-ios-label">{formatCurrency(payment.amount)}</p>
                <p className="text-xs text-ios-secondary">
                  {payment.currency === PaymentCurrency.BS && payment.amountBs
                    ? `Bs. ${payment.amountBs.toLocaleString("es-VE")}`
                    : "Divisas (€)"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ios-label">{payment.reference}</p>
                <p className="text-xs text-ios-secondary">{payment.bank}</p>
                {payment.submittedBy && payment.submittedBy.id !== user?.id && (
                  <p className="text-xs text-ios-secondary">
                    Registró: {payment.submittedBy.fullName}
                  </p>
                )}
              </div>
            </div>
            {payment.status === PaymentStatus.REJECTED && payment.rejectReason && (
              <p className="mt-2 text-xs text-ios-red">{payment.rejectReason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
            <tr>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Referencia</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ios-separator">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-ios-fill">
                <td className="px-5 py-3.5">
                  <div className="font-medium text-ios-label">
                    {payment.charge ? formatPeriod(payment.charge.period) : "—"}
                  </div>
                  <div className="text-xs text-ios-secondary">
                    {formatDate(payment.paymentDate)}
                  </div>
                  {showUnit && payment.property && (
                    <div className="text-xs font-medium text-brand-600">
                      {payment.property.code}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-ios-label">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="text-xs text-ios-secondary">
                    {payment.currency === PaymentCurrency.BS && payment.amountBs
                      ? `Bs. ${payment.amountBs.toLocaleString("es-VE")}`
                      : "Divisas (€)"}
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="text-ios-label">{payment.reference}</div>
                  <div className="text-xs text-ios-secondary">{payment.bank}</div>
                  {payment.submittedBy && payment.submittedBy.id !== user?.id && (
                    <div className="text-xs text-ios-secondary">
                      Registró: {payment.submittedBy.fullName}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={payment.status} />
                  {payment.status === PaymentStatus.REJECTED && payment.rejectReason && (
                    <div className="mt-1 text-xs text-ios-red">{payment.rejectReason}</div>
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
