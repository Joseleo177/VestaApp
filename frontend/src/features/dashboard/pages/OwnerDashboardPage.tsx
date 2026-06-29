import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Charge, ChargeStatus, ChargeType, PaymentStatus } from "@/types/domain";
import { formatCurrency, formatDate, formatPeriod, isOverdue } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAccountStatement } from "../hooks/useAccountStatement";
import { FinancialSummary } from "../components/FinancialSummary";
import { usePayments } from "@/features/payments/hooks/usePayments";
import { PaymentHistoryTable } from "@/features/payments/components/PaymentHistoryTable";
import { PaymentForm } from "@/features/payments/components/PaymentForm";

const STATUS_META: Record<ChargeStatus, { label: string; cls: string }> = {
  [ChargeStatus.PENDING]:    { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  [ChargeStatus.PAID]:       { label: "Pagada",     cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada",  cls: "bg-slate-100 text-slate-500 ring-slate-400/20" },
  [ChargeStatus.PARTIAL]:    { label: "Parcial",    cls: "bg-orange-50 text-orange-700 ring-orange-600/20" },
};

interface ChargesTableProps {
  charges: Charge[];
  loading: boolean;
  onPay: (charge: Charge) => void;
}

function ChargesTable({ charges, loading, onPay }: ChargesTableProps) {
  if (loading) return <Card className="overflow-hidden"><TableSkeleton rows={4} cols={5} /></Card>;
  if (charges.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="Sin cuotas"
          description="Aún no tienes cuotas emitidas."
        />
      </Card>
    );

  const sorted = [...charges].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Concepto</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Vence</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((c) => {
              const overdue  = c.status === ChargeStatus.PENDING && isOverdue(c.dueDate);
              const isPartial = c.status === ChargeStatus.PARTIAL;
              const canPay   = c.status === ChargeStatus.PENDING || isPartial;
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800">{formatPeriod(c.period)}</div>
                    {c.type === ChargeType.SPECIAL && (
                      <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600 ring-1 ring-inset ring-violet-500/20">
                        Especial
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[180px] truncate">
                    {c.description || "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-700">
                    {c.status === ChargeStatus.PAID
                      ? formatCurrency(c.amountPaid ?? c.amount)
                      : formatCurrency(c.amountDue ?? c.amount)}
                    {overdue && (
                      <div className="text-xs font-normal text-rose-500">mora incluida</div>
                    )}
                    {isPartial && (c.amountPaid ?? 0) > 0 && (
                      <div className="text-xs font-normal text-orange-500">
                        pagado: {formatCurrency(c.amountPaid ?? 0)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(c.dueDate)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                        STATUS_META[c.status].cls
                      )}
                    >
                      {STATUS_META[c.status].label}
                    </span>
                    {c.confirmedPayment && (
                      <div className="mt-1 font-mono text-xs text-slate-400">
                        {c.confirmedPayment.reference} · {c.confirmedPayment.bank}
                        <br />{formatDate(c.confirmedPayment.paymentDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {canPay && (
                      <Button size="sm" onClick={() => onPay(c)}>
                        Pagar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function OwnerDashboardPage() {
  const { statement, loading: loadingStatement, refetch: refetchStatement } =
    useAccountStatement();
  const { payments, loading: loadingPayments, refetch: refetchPayments } = usePayments();
  const [payCharge, setPayCharge] = useState<Charge | null>(null);

  const pendingCharges = useMemo(
    () =>
      statement?.charges.filter(
        (c) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL
      ) ?? [],
    [statement]
  );

  const lastConfirmed = useMemo(
    () => payments.find((p) => p.status === PaymentStatus.CONFIRMED),
    [payments]
  );

  const handleSuccess = () => {
    setPayCharge(null);
    void refetchPayments();
    void refetchStatement();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi estado de cuenta</h1>
        <p className="text-sm text-slate-500">Resumen financiero e historial de pagos</p>
      </div>

      <FinancialSummary
        statement={statement}
        lastConfirmed={lastConfirmed}
        loading={loadingStatement}
        creditBalance={statement?.creditBalance ?? 0}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Mis cuotas</h2>
        <ChargesTable
          charges={statement?.charges ?? []}
          loading={loadingStatement}
          onPay={setPayCharge}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Historial de pagos</h2>
        <PaymentHistoryTable payments={payments} loading={loadingPayments} />
      </div>

      <Modal
        open={payCharge !== null}
        onClose={() => setPayCharge(null)}
        title="Registrar un pago"
      >
        {pendingCharges.length > 0 ? (
          <PaymentForm
            charges={pendingCharges}
            defaultChargeId={payCharge?.id}
            onSuccess={handleSuccess}
            onCancel={() => setPayCharge(null)}
          />
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            No tienes cuotas pendientes por pagar.
          </p>
        )}
      </Modal>
    </div>
  );
}
