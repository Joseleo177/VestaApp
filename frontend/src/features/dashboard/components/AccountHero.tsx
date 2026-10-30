import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Check, Clock, Wallet } from "lucide-react";
import { Charge, Payment, Property } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { daysPastDue, dueAmount } from "../dueDays";
import { DueLabel } from "./DueLabel";

/** Celda de la ficha: rótulo, cifra y una línea de contexto. */
function Fact({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 border-ios-separator px-5 py-3.5",
        // 2 columnas en móvil, 4 en escritorio: los bordes siguen a la rejilla.
        "[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t",
        "lg:[&:not(:first-child)]:border-l lg:[&:nth-child(n+3)]:border-t-0"
      )}
    >
      <dt className="text-[12px] text-ios-secondary">{label}</dt>
      <dd className="mt-0.5 truncate text-[16px] font-semibold tabular-nums text-ios-label">{value}</dd>
      {sub && <dd className="mt-0.5 truncate text-[12px] text-ios-secondary">{sub}</dd>}
    </div>
  );
}

/** Aviso a lo ancho de la ficha. */
function Notice({ tone, icon, children }: { tone: "info" | "danger"; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 border-t px-5 py-3 text-[13px]",
        tone === "info"
          ? "border-sky-500/20 bg-sky-500/[0.06] text-sky-800 dark:text-sky-300"
          : "border-red-500/20 bg-red-500/[0.06] text-red-700 dark:text-red-300"
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface AccountHeroProps {
  loading: boolean;
  balance: number;
  balanceBs: number | null;
  creditBalance: number;
  open: Charge[];
  payable: Charge[];
  overdue: Charge[];
  nextDue?: Charge;
  lastConfirmed?: Payment;
  inReview: Payment[];
  lastRejected: Payment | null;
  properties: Property[];
  onPayAll: () => void;
}

/**
 * Lo primero que ve el vecino al entrar: cuánto debe, si está vencido y el
 * botón para pagar. Todo lo demás de la pantalla es detalle de esto.
 */
export function AccountHero(p: AccountHeroProps) {
  if (p.loading) {
    return (
      <Card className="space-y-4 p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-48 !rounded-lg" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-16 w-full !rounded-xl" />
      </Card>
    );
  }

  const owes = p.balance > 0.005;
  const payableTotal = p.payable.reduce((s, c) => s + dueAmount(c), 0);
  const reviewTotal = p.inReview.reduce((s, x) => s + Number(x.amount), 0);
  const lastOverdueDays = p.overdue.length ? daysPastDue(p.overdue[0].dueDate) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-5 px-5 pb-5 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ios-secondary">
            <Wallet className="h-4 w-4" />
            {owes ? "Saldo pendiente" : "Tu cuenta"}
          </p>

          {owes ? (
            <>
              <Money
                value={formatCurrency(p.balance)}
                className={cn(
                  "mt-1 block text-[34px] font-bold leading-tight tracking-tight",
                  p.overdue.length ? "text-red-600 dark:text-red-400" : "text-ios-label"
                )}
              />
              {p.balanceBs !== null && (
                <p className="text-[13px] tabular-nums text-ios-secondary">
                  ≈ Bs.{" "}
                  {p.balanceBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a
                  la tasa de hoy
                </p>
              )}
              <p
                className={cn(
                  "mt-1.5 text-[13px]",
                  p.overdue.length ? "font-medium text-red-600 dark:text-red-400" : "text-ios-secondary"
                )}
              >
                {p.open.length} {p.open.length === 1 ? "cuota pendiente" : "cuotas pendientes"}
                {p.overdue.length > 0 &&
                  ` · ${p.overdue.length} ${p.overdue.length === 1 ? "vencida" : "vencidas"}` +
                    ` (la más antigua hace ${lastOverdueDays} ${lastOverdueDays === 1 ? "día" : "días"})`}
              </p>
            </>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-[30px] font-bold leading-tight tracking-tight text-ios-label">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
              </span>
              Estás al día
            </p>
          )}
        </div>

        {/* La acción principal de la pantalla, a mano del pulgar en móvil. */}
        {p.payable.length > 0 && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button size="lg" className="w-full sm:w-auto" onClick={p.onPayAll}>
              {p.payable.length === 1 ? "Pagar" : "Pagar todo"}
              <Money value={formatCurrency(payableTotal)} className="opacity-90" />
            </Button>
            <Link
              to="/datos-de-pago"
              className="text-center text-[13px] font-medium text-brand-600 hover:underline"
            >
              Ver cuentas para transferir
            </Link>
          </div>
        )}
      </div>

      {p.inReview.length > 0 && (
        <Notice tone="info" icon={<Clock className="h-4 w-4" />}>
          <span className="font-semibold">
            {p.inReview.length === 1 ? "Tienes un pago en revisión" : `Tienes ${p.inReview.length} pagos en revisión`}
          </span>{" "}
          por <Money value={formatCurrency(reviewTotal)} className="font-semibold" />. La administración lo está
          validando; no hace falta que lo registres de nuevo.
        </Notice>
      )}

      {p.lastRejected && (
        <Notice tone="danger" icon={<AlertCircle className="h-4 w-4" />}>
          <span className="font-semibold">
            Tu pago del {formatDate(p.lastRejected.paymentDate)} fue rechazado
          </span>
          {p.lastRejected.rejectReason ? `: ${p.lastRejected.rejectReason}.` : "."} Revisa los datos y regístralo de
          nuevo.
        </Notice>
      )}

      <dl className="grid grid-cols-2 border-t border-ios-separator lg:grid-cols-4">
        <Fact
          label="Próximo vencimiento"
          value={p.nextDue ? formatDate(p.nextDue.dueDate) : "—"}
          sub={p.nextDue ? <DueLabel dueDate={p.nextDue.dueDate} /> : "Nada pendiente"}
        />
        <Fact
          label="Último pago"
          value={p.lastConfirmed ? <Money value={formatCurrency(p.lastConfirmed.amount)} /> : "—"}
          sub={p.lastConfirmed ? formatDate(p.lastConfirmed.paymentDate) : "Sin pagos confirmados"}
        />
        <Fact
          label="Saldo a favor"
          value={
            p.creditBalance > 0.005 ? (
              <Money value={formatCurrency(p.creditBalance)} className="text-violet-600 dark:text-violet-400" />
            ) : (
              <span className="font-medium text-ios-secondary">Sin saldo</span>
            )
          }
          sub={p.creditBalance > 0.005 ? "Úsalo al pagar tu próxima cuota" : undefined}
        />
        <Fact
          label={p.properties.length === 1 ? "Departamento" : "Departamentos"}
          value={p.properties.length ? p.properties.map((x) => x.code).join(", ") : "—"}
          sub={
            p.properties.length === 1
              ? p.properties[0].tower?.name
              : p.properties.length > 1
                ? `${p.properties.length} unidades`
                : undefined
          }
        />
      </dl>
    </Card>
  );
}
