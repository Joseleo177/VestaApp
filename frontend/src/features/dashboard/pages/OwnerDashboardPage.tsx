import { Check as CheckIcon } from "lucide-react";
import { Page } from "@/components/ui/Page";
import { useResident } from "../hooks/useResident";
import { AccountHero } from "../components/AccountHero";
import { ChargeRow } from "../components/ChargeRow";
import { PaymentRow } from "../components/PaymentRow";
import { QuietEmpty, RowsSkeleton, SectionCard } from "../components/SectionCard";
import { StatementButton } from "../components/StatementButton";

const PREVIEW = 3;

/**
 * Inicio del vecino: solo lo que hace falta para decidir. Cuánto debe y el botón
 * para pagar; debajo, un vistazo a lo próximo y a lo último. El detalle completo
 * vive en Mis cuotas y Mis pagos.
 */
export function OwnerDashboardPage() {
  const s = useResident();
  const firstName = s.user?.fullName?.trim().split(/\s+/)[0];

  return (
    <Page
      module="Mi cuenta"
      title={firstName ? `Hola, ${firstName}` : "Mi cuenta"}
      actions={<StatementButton />}
    >
      <AccountHero
        loading={s.loadingStatement}
        balance={s.balance}
        balanceBs={s.balanceBs}
        creditBalance={s.creditBalance}
        open={s.open}
        payable={s.payable}
        overdue={s.overdue}
        nextDue={s.nextDue}
        lastConfirmed={s.lastConfirmed}
        inReview={s.inReview}
        lastRejected={s.lastRejected}
        properties={s.properties}
        onPayAll={s.payAll}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SectionCard
          title="Próximas cuotas"
          subtitle={!s.loadingStatement && s.open.length > PREVIEW ? `${PREVIEW} de ${s.open.length}` : undefined}
          more={
            s.open.length > PREVIEW
              ? { to: "/cuotas", label: "Ver todas mis cuotas" }
              : s.closed.length > 0
                ? { to: "/cuotas", label: "Ver mis cuotas pagadas" }
                : undefined
          }
        >
          {s.loadingStatement ? (
            <RowsSkeleton />
          ) : s.open.length === 0 ? (
            <QuietEmpty
              icon={
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                </span>
              }
              title="No tienes cuotas pendientes"
              hint="Cuando se emita la próxima, aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-ios-separator">
              {s.open.slice(0, PREVIEW).map((c) => (
                <ChargeRow key={c.id} charge={c} multiUnit={s.multiUnit} onPay={s.payOne} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Últimos pagos"
          more={s.payments.length > 0 ? { to: "/pagos", label: "Ver todos mis pagos" } : undefined}
        >
          {s.loadingPayments ? (
            <RowsSkeleton />
          ) : s.payments.length === 0 ? (
            <QuietEmpty title="Aún no registras pagos" hint="Cuando pagues una cuota, la verás aquí con su estado." />
          ) : (
            <ul className="divide-y divide-ios-separator">
              {s.payments.slice(0, PREVIEW).map((p) => (
                <PaymentRow key={p.id} payment={p} multiUnit={s.multiUnit} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </Page>
  );
}
