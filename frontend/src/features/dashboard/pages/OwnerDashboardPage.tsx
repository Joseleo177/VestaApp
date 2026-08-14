import { useMemo, useState } from "react";
import { Receipt, Download, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { paymentService } from "@/features/payments/services/payment.service";
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
  [ChargeStatus.PENDING]:    { label: "Pendiente",  cls: "bg-ios-orange/10 text-ios-orange" },
  [ChargeStatus.PAID]:       { label: "Pagada",     cls: "bg-ios-green/10 text-ios-green" },
  [ChargeStatus.EXONERATED]: { label: "Exonerada",  cls: "bg-ios-fill text-ios-secondary" },
  [ChargeStatus.PARTIAL]:    { label: "Parcial",    cls: "bg-ios-orange/10 text-ios-orange" },
};

interface ChargesTableProps {
  charges: Charge[];
  loading: boolean;
  onPay: (charge: Charge) => void;
}

function ChargesTable({ charges, loading, onPay }: ChargesTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Quien gestiona varias unidades (titular de una, autorizado de otra) necesita
  // ver a qué departamento pertenece cada cuota.
  const showUnit = useMemo(
    () => new Set(charges.map((c) => c.property?.id ?? "")).size > 1,
    [charges]
  );

  const handleDownload = async (paymentId: string, receiptNumber: string) => {
    setDownloadingId(paymentId);
    try {
      await paymentService.downloadReceipt(paymentId, receiptNumber);
    } catch {
      toast.error("No se pudo descargar el recibo");
    } finally {
      setDownloadingId(null);
    }
  };

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
      {/* Vista móvil: tarjetas */}
      <div className="sm:hidden divide-y divide-ios-separator">
        {sorted.map((c) => {
          const overdue   = c.status === ChargeStatus.PENDING && isOverdue(c.dueDate);
          const isPartial = c.status === ChargeStatus.PARTIAL;
          const canPay    = c.status === ChargeStatus.PENDING || isPartial;
          const amount    = c.status === ChargeStatus.PAID
            ? formatCurrency(c.amountPaid ?? c.amount)
            : formatCurrency(c.amountDue ?? c.amount);
          return (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ios-label">{formatPeriod(c.period)}</span>
                    {c.type === ChargeType.SPECIAL && (
                      <span className="inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple">
                        Especial
                      </span>
                    )}
                  </div>
                  {showUnit && c.property && (
                    <p className="mt-0.5 text-xs font-medium text-brand-600">
                      {c.property.code}
                    </p>
                  )}
                  {c.description && (
                    <p className="mt-0.5 text-xs text-ios-secondary truncate">{c.description}</p>
                  )}
                </div>
                {c.pendingPayment ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-ios-blue/10 px-2.5 py-0.5 text-xs font-medium text-ios-blue">
                    <Clock className="h-3 w-3" /> En revisión
                  </span>
                ) : (
                  <span
                    className={cn(
                      "shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      STATUS_META[c.status].cls
                    )}
                  >
                    {STATUS_META[c.status].label}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-ios-label">{amount}</p>
                  {overdue && <p className="text-xs text-ios-red">mora incluida</p>}
                  {isPartial && (c.amountPaid ?? 0) > 0 && (
                    <p className="text-xs text-ios-orange">pagado: {formatCurrency(c.amountPaid ?? 0)}</p>
                  )}
                  <p className="text-xs text-ios-secondary">Vence {formatDate(c.dueDate)}</p>
                  {c.confirmedPayment && (
                    <p className="mt-0.5 font-mono text-xs text-ios-secondary">
                      {c.confirmedPayment.reference} · {c.confirmedPayment.bank}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {canPay && !c.pendingPayment && (
                    <Button size="sm" onClick={() => onPay(c)}>Pagar</Button>
                  )}
                  {c.pendingPayment && (
                    <span className="self-center text-right text-xs text-ios-blue">
                      {formatCurrency(c.pendingPayment.amount)}
                      <br />
                      esperando validación
                    </span>
                  )}
                  {c.status === ChargeStatus.PAID && c.confirmedPayment?.receiptNumber && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === c.confirmedPayment.id}
                      onClick={() => handleDownload(c.confirmedPayment!.id, c.confirmedPayment!.receiptNumber!)}
                    >
                      {downloadingId === c.confirmedPayment.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      PDF
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vista desktop: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ios-separator text-[11px] font-semibold uppercase tracking-wider text-ios-secondary">
            <tr>
              <th className="px-5 py-3 font-medium">Período</th>
              <th className="px-5 py-3 font-medium">Concepto</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Vence</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ios-separator">
            {sorted.map((c) => {
              const overdue  = c.status === ChargeStatus.PENDING && isOverdue(c.dueDate);
              const isPartial = c.status === ChargeStatus.PARTIAL;
              const canPay   = c.status === ChargeStatus.PENDING || isPartial;
              return (
                <tr key={c.id} className="hover:bg-ios-fill">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-ios-label">{formatPeriod(c.period)}</div>
                    {showUnit && c.property && (
                      <div className="text-xs font-medium text-brand-600">{c.property.code}</div>
                    )}
                    {c.type === ChargeType.SPECIAL && (
                      <span className="inline-flex rounded-full bg-ios-purple/10 px-2 py-0.5 text-xs font-medium text-ios-purple">
                        Especial
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ios-secondary max-w-[180px] truncate">
                    {c.description || "—"}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-ios-label">
                    {c.status === ChargeStatus.PAID
                      ? formatCurrency(c.amountPaid ?? c.amount)
                      : formatCurrency(c.amountDue ?? c.amount)}
                    {overdue && (
                      <div className="text-xs font-normal text-ios-red">mora incluida</div>
                    )}
                    {isPartial && (c.amountPaid ?? 0) > 0 && (
                      <div className="text-xs font-normal text-ios-orange">
                        pagado: {formatCurrency(c.amountPaid ?? 0)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ios-secondary">{formatDate(c.dueDate)}</td>
                  <td className="px-5 py-3.5">
                    {c.pendingPayment ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ios-blue/10 px-2.5 py-0.5 text-xs font-medium text-ios-blue">
                        <Clock className="h-3 w-3" /> En revisión
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_META[c.status].cls
                        )}
                      >
                        {STATUS_META[c.status].label}
                      </span>
                    )}
                    {c.pendingPayment && (
                      <div className="mt-1 text-xs text-ios-blue">
                        {formatCurrency(c.pendingPayment.amount)} esperando validación
                      </div>
                    )}
                    {c.confirmedPayment && (
                      <div className="mt-1 font-mono text-xs text-ios-secondary">
                        {c.confirmedPayment.reference} · {c.confirmedPayment.bank}
                        <br />{formatDate(c.confirmedPayment.paymentDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {canPay && !c.pendingPayment && (
                      <Button size="sm" onClick={() => onPay(c)}>
                        Pagar
                      </Button>
                    )}
                    {c.status === ChargeStatus.PAID && c.confirmedPayment?.receiptNumber && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloadingId === c.confirmedPayment.id}
                        onClick={() => handleDownload(c.confirmedPayment!.id, c.confirmedPayment!.receiptNumber!)}
                      >
                        {downloadingId === c.confirmedPayment.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Download className="h-3.5 w-3.5" />}
                        PDF
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
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Mi estado de cuenta</h1>
        <p className="text-sm text-ios-secondary">Resumen financiero e historial de pagos</p>
      </div>

      <FinancialSummary
        statement={statement}
        lastConfirmed={lastConfirmed}
        loading={loadingStatement}
        creditBalance={statement?.creditBalance ?? 0}
      />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ios-label">Mis cuotas</h2>
        <ChargesTable
          charges={statement?.charges ?? []}
          loading={loadingStatement}
          onPay={setPayCharge}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-ios-label">Historial de pagos</h2>
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
          <p className="py-4 text-center text-sm text-ios-secondary">
            No tienes cuotas pendientes por pagar.
          </p>
        )}
      </Modal>
    </div>
  );
}
