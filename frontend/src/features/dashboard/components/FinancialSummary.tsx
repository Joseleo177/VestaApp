import { CalendarClock, CheckCircle2, PiggyBank, Wallet } from "lucide-react";
import { AccountStatement, Charge, ChargeStatus, Payment } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatBs, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { useExchangeRate } from "@/features/exchange-rate/hooks/useExchangeRate";
import { cn } from "@/lib/cn";

interface FinancialSummaryProps {
  statement: AccountStatement | null;
  lastConfirmed?: Payment;
  loading: boolean;
  creditBalance?: number;
}

function nextDueCharge(charges: Charge[]): Charge | undefined {
  return charges
    .filter((c) => c.status === ChargeStatus.PENDING)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
}

/** Widget KPI: monto pendiente, fecha límite (badge rojo si vencida), último pago, saldo a favor. */
export function FinancialSummary({ statement, lastConfirmed, loading, creditBalance = 0 }: FinancialSummaryProps) {
  const { data: rate } = useExchangeRate();

  const cols = creditBalance > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3";

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-4 ${cols}`}>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  const balance = statement?.balance ?? 0;
  const due = statement ? nextDueCharge(statement.charges) : undefined;
  const overdue = due ? isOverdue(due.dueDate) : false;
  const pendingCount = statement?.charges.filter(
    (c) => c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL
  ).length ?? 0;
  const hasOverdue = statement?.charges.some(
    (c) => (c.status === ChargeStatus.PENDING || c.status === ChargeStatus.PARTIAL) && isOverdue(c.dueDate)
  ) ?? false;

  return (
    <div className={`grid grid-cols-1 gap-4 ${cols}`}>
      {/* Monto pendiente */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Wallet className="h-4 w-4" /> Monto pendiente
        </div>
        <p
          className={cn(
            "mt-2 text-3xl font-bold",
            balance > 0 ? "text-slate-800" : "text-emerald-600"
          )}
        >
          {formatCurrency(balance)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {balance > 0
            ? (
              <span className="space-y-0.5 flex flex-col">
                {rate && <span>≈ {formatBs(balance, rate.rate)}</span>}
                <span>
                  {pendingCount} cuota{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}
                  {hasOverdue && <span className="ml-1 text-rose-500 font-medium">· incluye mora</span>}
                </span>
              </span>
            )
            : "Estás al día"}
        </p>
      </Card>

      {/* Fecha límite */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <CalendarClock className="h-4 w-4" /> Fecha límite
        </div>
        <p className="mt-2 text-3xl font-bold text-slate-800">
          {due ? formatDate(due.dueDate) : "—"}
        </p>
        {due && (
          <span
            className={cn(
              "mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              overdue
                ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                : "bg-slate-100 text-slate-600 ring-slate-500/20"
            )}
          >
            {overdue ? "Vencido" : "Al día"}
          </span>
        )}
      </Card>

      {/* Último pago confirmado */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <CheckCircle2 className="h-4 w-4" /> Último pago confirmado
        </div>
        <p className="mt-2 text-3xl font-bold text-emerald-600">
          {lastConfirmed ? formatCurrency(lastConfirmed.amount) : "—"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {lastConfirmed ? formatDate(lastConfirmed.paymentDate) : "Sin pagos confirmados"}
        </p>
      </Card>

      {/* Saldo a favor — solo visible si hay crédito */}
      {creditBalance > 0 && (
        <Card className="p-5 border-violet-200 bg-violet-50/40">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-600">
            <PiggyBank className="h-4 w-4" /> Saldo a favor
          </div>
          <p className="mt-2 text-3xl font-bold text-violet-700">
            {formatCurrency(creditBalance)}
          </p>
          <p className="mt-1 text-xs text-violet-400">
            Se aplicará automáticamente a tu próxima cuota
          </p>
        </Card>
      )}
    </div>
  );
}
